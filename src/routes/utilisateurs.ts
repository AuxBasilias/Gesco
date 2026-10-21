import express, { type Request } from "express";
import { authMiddleware, adminMiddleware } from "../auth/auth";
import {
  createUtilisateur,
  getAllUtilisateurs,
  getUtilisateurById,
  updateUtilisateur,
} from "../services/utilisateurs";

import { roleEnum } from "../db/schema";

const router = express.Router();
type Role = (typeof roleEnum.enumValues)[number];
const validRoles = new Set<Role>(["admin", "user", "caissiere", "comptable"]);
const roleLabels: Record<Role, string> = {
  admin: "administrateur",
  user: "utilisateur standard",
  caissiere: "caissière",
  comptable: "comptable",
};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function actorId(req: Request): number | undefined {
  return (req as Request & { user?: { id?: number } }).user?.id;
}

function actorRole(req: Request): string | undefined {
  return (req as Request & { user?: { role?: string } }).user?.role;
}

function dbErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return String(error.code);
}

router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const users = await getAllUtilisateurs();
    res.json(actorRole(req) === "admin"
      ? users
      : users.map(({ id, nomUtilisateur, role, actif }) => ({ id, nomUtilisateur, role, actif })));
  } catch {
    res.status(500).json({ success: false, message: "Impossible de charger les utilisateurs." });
  }
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ success: false, message: "Identifiant invalide." });
    return;
  }
  if (actorRole(req) !== "admin" && actorId(req) !== id) {
    res.status(403).json({ success: false, message: "Vous ne pouvez consulter que votre propre compte." });
    return;
  }
  try {
    const utilisateur = await getUtilisateurById(id);
    if (!utilisateur) {
      res.status(404).json({ success: false, message: "Utilisateur introuvable." });
      return;
    }
    res.json(utilisateur);
  } catch {
    res.status(500).json({ success: false, message: "Impossible de charger cet utilisateur." });
  }
});

router.post("/", adminMiddleware, async (req, res) => {
  const { nomUtilisateur, email, motDePasse, role, telephone } = req.body ?? {};
  if (typeof nomUtilisateur !== "string" || nomUtilisateur.trim().length < 2) {
    res.status(400).json({ success: false, message: "Le nom d'utilisateur doit contenir au moins 2 caractères." });
    return;
  }
  if (typeof email !== "string" || !emailPattern.test(email.trim())) {
    res.status(400).json({ success: false, message: "Saisissez une adresse e-mail valide." });
    return;
  }
  if (typeof motDePasse !== "string" || motDePasse.length < 8) {
    res.status(400).json({ success: false, message: "Le mot de passe doit contenir au moins 8 caractères." });
    return;
  }
  if (typeof role !== "string" || !validRoles.has(role as Role)) {
    res.status(400).json({
      success: false,
      message: `Le rôle doit être l'un des suivants : ${Object.values(roleLabels).join(", ")}.`,
    });
    return;
  }
  try {
    const utilisateur = await createUtilisateur({
      nomUtilisateur: nomUtilisateur.trim(),
      email: email.trim().toLocaleLowerCase("en"),
      motDePasse,
      role: role as Role,
      telephone: typeof telephone === "string" && telephone.trim() ? telephone.trim() : null,
      actif: true,
    });
    res.status(201).json({ success: true, utilisateur });
  } catch (error) {
    if (dbErrorCode(error) === "23505") {
      res.status(409).json({ success: false, message: "Ce nom d'utilisateur ou cette adresse e-mail existe déjà." });
      return;
    }
    console.error("Erreur de création d'utilisateur :", error);
    res.status(500).json({ success: false, message: "Impossible de créer l'utilisateur." });
  }
});

router.put("/:id", adminMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ success: false, message: "Identifiant invalide." });
    return;
  }
  const { nomUtilisateur, email, motDePasse, role, telephone, actif } = req.body ?? {};
  const updates: {
    nomUtilisateur?: string;
    email?: string;
    motDePasse?: string;
    role?: Role;
    telephone?: string | null;
    actif?: boolean;
  } = {};
  if (nomUtilisateur !== undefined) {
    if (typeof nomUtilisateur !== "string" || nomUtilisateur.trim().length < 2) {
      res.status(400).json({ success: false, message: "Le nom d'utilisateur doit contenir au moins 2 caractères." });
      return;
    }
    updates.nomUtilisateur = nomUtilisateur.trim();
  }
  if (email !== undefined) {
    if (typeof email !== "string" || !emailPattern.test(email.trim())) {
      res.status(400).json({ success: false, message: "Saisissez une adresse e-mail valide." });
      return;
    }
    updates.email = email.trim().toLocaleLowerCase("en");
  }
  if (motDePasse !== undefined) {
    if (typeof motDePasse !== "string" || motDePasse.length < 8) {
      res.status(400).json({ success: false, message: "Le mot de passe doit contenir au moins 8 caractères." });
      return;
    }
    updates.motDePasse = motDePasse;
  }
  if (role !== undefined) {
    if (typeof role !== "string" || !validRoles.has(role as Role)) {
      res.status(400).json({
        success: false,
        message: `Le rôle doit être l'un des suivants : ${Object.values(roleLabels).join(", ")}.`,
      });
      return;
    }
    updates.role = role as Role;
  }
  if (telephone !== undefined) {
    if (telephone !== null && typeof telephone !== "string") {
      res.status(400).json({ success: false, message: "Le téléphone est invalide." });
      return;
    }
    updates.telephone = typeof telephone === "string" && telephone.trim() ? telephone.trim() : null;
  }
  if (actif !== undefined) {
    if (typeof actif !== "boolean") {
      res.status(400).json({ success: false, message: "L'état actif doit être vrai ou faux." });
      return;
    }
    updates.actif = actif;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ success: false, message: "Aucune modification à enregistrer." });
    return;
  }
  const currentActorId = actorId(req);
  if (id === currentActorId && (updates.actif === false || updates.role === "user")) {
    res.status(409).json({ success: false, message: "Vous ne pouvez pas désactiver ou rétrograder votre propre compte." });
    return;
  }
  try {
    if (updates.actif === false || updates.role === "user") {
      const users = await getAllUtilisateurs();
      const anotherActiveAdmin = users.some((user) =>
        user.id !== id && user.role === "admin" && user.actif,
      );
      const targetIsActiveAdmin = users.some((user) => user.id === id && user.role === "admin" && user.actif);
      if (targetIsActiveAdmin && !anotherActiveAdmin) {
        res.status(409).json({ success: false, message: "Impossible de retirer le dernier compte administrateur actif." });
        return;
      }
    }
    const utilisateur = await updateUtilisateur(id, updates);
    if (!utilisateur) {
      res.status(404).json({ success: false, message: "Utilisateur introuvable." });
      return;
    }
    res.json({ success: true, utilisateur });
  } catch (error) {
    if (dbErrorCode(error) === "23505") {
      res.status(409).json({ success: false, message: "Ce nom d'utilisateur ou cette adresse e-mail existe déjà." });
      return;
    }
    console.error("Erreur de mise à jour d'utilisateur :", error);
    res.status(500).json({ success: false, message: "Impossible de mettre à jour l'utilisateur." });
  }
});

export default router;
