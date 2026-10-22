import "dotenv/config";
import { verifierMotDePasse } from "./password.js";
import * as utilisateurService from "../services/utilisateurs.js";
import jwt from 'jsonwebtoken';
import { Request, RequestHandler, Response } from "express";
import bcrypt from "bcryptjs";
import { utilisateursTable } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/db.js";

const SECRET: string = process.env.JWT_SECRET ?? "";
if (!SECRET || SECRET.length < 32) {
  throw new Error("JWT_SECRET doit être défini dans l'environnement et contenir au moins 32 caractères.");
}

export async function login(
  email: string,
  motDePasse: string
) {
  try {
    const utilisateur = await utilisateurService.getUtilisateurByEmail(email);

    if (!utilisateur) {
      throw new Error("Mail ou mot de passe incorrect.");
    }

    if (!utilisateur.actif) {
      throw new Error("Ce compte est désactivé.");
    }

    const motDePasseValide = await verifierMotDePasse(
      motDePasse,
      utilisateur.motDePasse
    );

    if (!motDePasseValide) {
      throw new Error("Identifiants incorrect.");
    }


    // 🆕 AJOUT : création du token
    const token = jwt.sign(
      {
        id: utilisateur.id,
        role: utilisateur.role,
        tv: utilisateur.tokenVersion ?? 0
      },
      SECRET,
      {
        expiresIn: '1d'
      }
    );

    console.log("✅ Connexion réussie.");

    return {
      success: true,
      message: "Login successful",
      token, // 👈 IMPORTANT
      utilisateur: {
        id: utilisateur.id,
        email:utilisateur.email,
        nom: utilisateur.nomUtilisateur,
        role: utilisateur.role,
        actif: utilisateur.actif,
      },
    };

  } catch (error) {
    console.error("❌ Erreur lors de la connexion :", error);
    throw error;
  }
}

export async function logout(idUtilisateur?: number) {
  // Révoque tous les tokens émis pour cet utilisateur en incrémentant sa version.
  if (idUtilisateur && Number.isSafeInteger(idUtilisateur) && idUtilisateur > 0) {
    try {
      await db
        .update(utilisateursTable)
        .set({ tokenVersion: sql`${utilisateursTable.tokenVersion} + 1`, updatedAt: new Date() })
        .where(eq(utilisateursTable.id, idUtilisateur));
    } catch (error) {
      console.error("Erreur lors de la révocation de session :", error);
      throw error;
    }
  }
  return {
    success: true,
    message: "Logout successful",
  };
}




export const authMiddleware: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    res.status(401).json({ message: 'Token manquant' });
    return;
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ message: "Token invalide" });
    return;
  }
  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, SECRET);
  } catch {
    res.status(401).json({ message: 'Token invalide' });
    return;
  }
  if (!decoded || typeof decoded === "string" || !Number.isSafeInteger(Number(decoded.id))) {
    res.status(401).json({ message: "Token invalide" });
    return;
  }
  try {
    const [user] = await db.select({
      id: utilisateursTable.id,
      role: utilisateursTable.role,
      actif: utilisateursTable.actif,
      tokenVersion: utilisateursTable.tokenVersion,
    }).from(utilisateursTable).where(eq(utilisateursTable.id, Number(decoded.id))).limit(1);
    if (!user || !user.actif) {
      res.status(401).json({ message: "Compte introuvable ou désactivé." });
      return;
    }
    const tokenVersion = Number((decoded as jwt.JwtPayload).tv ?? 0);
    if (tokenVersion !== (user.tokenVersion ?? 0)) {
      res.status(401).json({ message: "Session expirée. Reconnectez-vous." });
      return;
    }
    (req as Request & { user?: { id: number; role: string } }).user = {
      id: user.id,
      role: user.role,
    };
    next();
  } catch (error) {
    console.error("Erreur de vérification de session :", error);
    res.status(500).json({ message: "Impossible de vérifier la session utilisateur." });
  }
};

export const adminMiddleware: RequestHandler = (req, res, next) => {
  const user = (req as Request & { user?: { role?: string } }).user;
  if (user?.role !== "admin") {
    res.status(403).json({ success: false, message: "Droits administrateur requis." });
    return;
  }
  next();
};



export const changePassword = async (req: Request, res: Response) => {
  try {
    const { motDePasse, motDePasseNouveau } = req.body;
    const userId = (req as any).user?.id; // De la session/token JWT

    // ✅ Validations
    if (!motDePasse || !motDePasseNouveau) {
      return res.status(400).json({
        success: false,
        message: "Tous les champs sont obligatoires.",
      });
    }

    if (motDePasseNouveau.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Le mot de passe doit contenir au moins 8 caractères.",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Utilisateur non authentifié.",
      });
    }

    // ✅ Récupère l'utilisateur
    const utilisateur = await db
      .select()
      .from(utilisateursTable)
      .where(eq(utilisateursTable.id, userId))
      .limit(1);

    if (utilisateur.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé.",
      });
    }

    const user = utilisateur[0];

    // ✅ Vérifie le mot de passe actuel
    const isValid = await bcrypt.compare(motDePasse, user.motDePasse);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Mot de passe actuel incorrect.",
      });
    }

    // ✅ Hash le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(motDePasseNouveau, 12);

    // ✅ Met à jour en base de données
    await db
      .update(utilisateursTable)
      .set({ motDePasse: hashedPassword })
      .where(eq(utilisateursTable.id, userId));

    return res.json({
      success: true,
      message: "Mot de passe modifié avec succès.",
    });
  } catch (error) {
    console.error("Erreur changement password:", error);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur.",
    });
  }
};