import { Request, Response } from "express";
import { db } from "../db/db.js";
import { fournisseurs, commandesFournisseurs, lignesCommande } from "../db/schema.js";
import { desc, eq, inArray } from "drizzle-orm";


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


export async function getFournisseurStats(
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

        const [supplier] = await db
            .select()
            .from(fournisseurs)
            .where(eq(fournisseurs.id, id));

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: "Fournisseur introuvable.",
            });
        }

        const orders = await db
            .select()
            .from(commandesFournisseurs)
            .where(eq(commandesFournisseurs.idFournisseur, id))
            .orderBy(desc(commandesFournisseurs.dateCommande));

        const orderIds = orders.map((order) => order.id);
        const lines = orderIds.length > 0
            ? await db.select().from(lignesCommande).where(inArray(lignesCommande.idCommande, orderIds))
            : [];

        const linesByOrder = new Map<number, typeof lines>();
        lines.forEach((line) => {
            const bucket = linesByOrder.get(line.idCommande) ?? [];
            bucket.push(line);
            linesByOrder.set(line.idCommande, bucket);
        });

        const articleCount = new Map<number, number>();
        const products = new Map<string, { designation: string; quantite: number; dernierPrix: number; montantTotal: number }>();

        // Les commandes sont triées du plus récent au plus ancien : le premier
        // prix rencontré pour un produit correspond à son dernier prix d'achat.
        orders.forEach((order) => {
            let count = 0;
            (linesByOrder.get(order.id) ?? []).forEach((line) => {
                const quantite = Number(line.quantite || 0);
                count += quantite;
                const designation = line.designation || `Produit ${line.idProduit}`;
                const entry = products.get(designation);
                if (!entry) {
                    products.set(designation, {
                        designation,
                        quantite: quantite,
                        dernierPrix: Number(line.prixUnitaire || 0),
                        montantTotal: Number(line.montantTotal || 0),
                    });
                    return;
                }
                entry.quantite += quantite;
                entry.montantTotal += Number(line.montantTotal || 0);
            });
            articleCount.set(order.id, count);
        });

        const totalAchats = orders.reduce((sum, order) => sum + Number(order.montantTotal || 0), 0);
        const enCours = orders.filter((order) => !["recue", "annulee"].includes(order.statut)).length;

        return res.status(200).json({
            success: true,
            data: {
                totaux: {
                    nbCommandes: orders.length,
                    totalAchats: String(totalAchats),
                    enCours,
                    derniereCommande: orders.length > 0 ? orders[0].dateCommande : null,
                },
                commandes: orders.map((order) => ({
                    ...order,
                    articleCount: articleCount.get(order.id) ?? 0,
                })),
                produits: Array.from(products.values()),
            },
        });

    } catch (error) {
        console.error("Erreur getFournisseurStats :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des statistiques du fournisseur.",
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

        // Les commandes référencent le fournisseur (onDelete = restrict) :
        // on bloque la suppression tant que des commandes lui sont rattachées.
        const linkedOrders = await db
            .select({ id: commandesFournisseurs.id })
            .from(commandesFournisseurs)
            .where(eq(commandesFournisseurs.idFournisseur, id));

        if (linkedOrders.length > 0) {
            return res.status(409).json({
                success: false,
                message: `Ce fournisseur est rattaché à ${linkedOrders.length} commande(s). Supprimez d'abord ces commandes pour pouvoir le supprimer.`,
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