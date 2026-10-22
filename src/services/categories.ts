import { Request, Response } from "express";
import { db } from "../db/db.js";
import { categories } from "../db/schema.js";
import { desc, eq } from "drizzle-orm";


export async function getAllCategories(
    req: Request,
    res: Response
) {
    try {
        const result = await db
            .select()
            .from(categories)
            .orderBy(desc(categories.createdAt), desc(categories.id));

        return res.status(200).json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error("Erreur getAllCategories :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des catégories.",
        });
    }
}


export async function getCategorieById(
    req: Request,
    res: Response
) {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID de catégorie invalide.",
            });
        }

        const result = await db
            .select()
            .from(categories)
            .where(eq(categories.id, id));

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Catégorie introuvable.",
            });
        }

        return res.status(200).json({
            success: true,
            data: result[0],
        });

    } catch (error) {
        console.error("Erreur getCategorieById :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération de la catégorie.",
        });
    }
}


export async function createCategorie(
    req: Request,
    res: Response
) {
    try {
        const { label } = req.body;

        if (!label || !label.trim()) {
            return res.status(400).json({
                success: false,
                message: "Le label de la catégorie est obligatoire.",
            });
        }

        const result = await db
            .insert(categories)
            .values({
                label: label.trim(),
            })
            .returning();

        return res.status(201).json({
            success: true,
            message: "Catégorie créée avec succès.",
            data: result[0],
        });

    } catch (error) {
        console.error("Erreur createCategorie :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la création de la catégorie.",
        });
    }
}


export async function updateCategorie(
    req: Request,
    res: Response
) {
    try {
        const id = Number(req.params.id);
        const { label } = req.body;

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID de catégorie invalide.",
            });
        }

        if (!label || !label.trim()) {
            return res.status(400).json({
                success: false,
                message: "Le label de la catégorie est obligatoire.",
            });
        }

        const result = await db
            .update(categories)
            .set({
                label: label.trim(),
            })
            .where(eq(categories.id, id))
            .returning();

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Catégorie introuvable.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Catégorie modifiée avec succès.",
            data: result[0],
        });

    } catch (error) {
        console.error("Erreur updateCategorie :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la modification de la catégorie.",
        });
    }
}


export async function deleteCategorie(
    req: Request,
    res: Response
) {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID de catégorie invalide.",
            });
        }

        const result = await db
            .delete(categories)
            .where(eq(categories.id, id))
            .returning();

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Catégorie introuvable.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Catégorie supprimée avec succès.",
            data: result[0],
        });

    } catch (error) {
        console.error("Erreur deleteCategorie :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la suppression de la catégorie.",
        });
    }
}