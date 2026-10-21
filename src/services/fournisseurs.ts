import { Request, Response } from "express";
import { db } from "../db/db";
import { fournisseurs } from "../db/schema";
import { desc, eq } from "drizzle-orm";


export async function getAllFournisseurs(
    req: Request,
    res: Response
) {
    try {
        const result = await db
            .select()
            .from(fournisseurs)
            .orderBy(desc(fournisseurs.createdAt), desc(fournisseurs.id));

        return res.status(200).json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error("Erreur getAllFournisseurs :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des fournisseurs.",
        });
    }
}


export async function getFournisseurById(
    req: Request,
    res: Response
) {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID de fournisseur invalide.",
            });
        }

        const result = await db
            .select()
            .from(fournisseurs)
            .where(eq(fournisseurs.id, id));

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Fournisseur introuvable.",
            });
        }

        return res.status(200).json({
            success: true,
            data: result[0],
        });

    } catch (error) {
        console.error("Erreur getFournisseurById :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération du fournisseur.",
        });
    }
}


export async function createFournisseur(
    req: Request,
    res: Response
) {
    try {
        const {
            nom,
        } = req.body;

        if (!nom || !nom.trim()) {
            return res.status(400).json({
                success: false,
                message: "Le nom du fournisseur est obligatoire.",
            });
        }

        const result = await db
            .insert(fournisseurs)
            .values(req.body)
            .returning();

        return res.status(201).json({
            success: true,
            message: "Fournisseur créé avec succès.",
            data: result[0],
        });

    } catch (error) {
        console.error("Erreur createFournisseur :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la création du fournisseur.",
        });
    }
}


export async function updateFournisseur(
    req: Request,
    res: Response
) {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID de fournisseur invalide.",
            });
        }

        const result = await db
            .update(fournisseurs)
            .set(req.body)
            .where(eq(fournisseurs.id, id))
            .returning();

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Fournisseur introuvable.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Fournisseur modifié avec succès.",
            data: result[0],
        });

    } catch (error) {
        console.error("Erreur updateFournisseur :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la modification du fournisseur.",
        });
    }
}


export async function deleteFournisseur(
    req: Request,
    res: Response
) {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID de fournisseur invalide.",
            });
        }

        const result = await db
            .delete(fournisseurs)
            .where(eq(fournisseurs.id, id))
            .returning();

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Fournisseur introuvable.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Fournisseur supprimé avec succès.",
            data: result[0],
        });

    } catch (error) {
        console.error("Erreur deleteFournisseur :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la suppression du fournisseur.",
        });
    }
}