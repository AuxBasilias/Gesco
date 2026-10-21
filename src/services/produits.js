import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/db";
import { categories, fournisseurs, journalActivite, mouvementsStock, produits, stocks } from "../db/schema";
class InputError extends Error {
}
function requestUserId(req) {
    const userId = Number(req.user?.id);
    return Number.isSafeInteger(userId) && userId > 0 ? userId : undefined;
}
function entierPositifOuZero(value, label) {
    if (value === undefined || value === null || value === "")
        return null;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0)
        throw new InputError(`${label} doit être un entier positif ou nul.`);
    return parsed;
}
function prixValide(value, label) {
    if (value === undefined || value === null || value === "")
        return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0)
        throw new InputError(`${label} doit être un montant positif ou nul.`);
    return parsed.toFixed(2);
}
function chaine(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function repondreErreur(res, erreur, message) {
    console.error(message, erreur);
    if (erreur instanceof InputError) {
        return res.status(400).json({ success: false, message: erreur.message });
    }
    const code = erreur?.code;
    if (code === "23505") {
        return res.status(409).json({ success: false, message: "Ce produit existe déjà." });
    }
    if (code === "23503") {
        return res.status(400).json({ success: false, message: "La catégorie ou le fournisseur sélectionné n'existe pas." });
    }
    return res.status(500).json({ success: false, message: "Une erreur est survenue lors de l'enregistrement du produit." });
}
export async function getAllProduits(_req, res) {
    try {
        const rows = await db.select({
            id: produits.id,
            designation: produits.designation,
            idCategorie: produits.idCategorie,
            description: produits.description,
            prixAchat: produits.prixAchat,
            prixVente: produits.prixVente,
            createdAt: produits.createdAt,
            updatedAt: produits.updatedAt,
            quantite: stocks.quantite,
            seuilMinimum: stocks.seuilMinimum,
            idFournisseur: stocks.idFournisseur,
        })
            .from(produits)
            .leftJoin(stocks, eq(stocks.idProduit, produits.id))
            .where(eq(produits.archive, false))
            .orderBy(desc(produits.createdAt), desc(produits.id));
        res.status(200).json({
            success: true,
            data: rows.map((row) => ({
                id: row.id,
                designation: row.designation,
                idCategorie: row.idCategorie,
                description: row.description,
                prixAchat: row.prixAchat,
                prixVente: row.prixVente,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                stock: row.quantite ?? 0,
                seuilMinimum: row.seuilMinimum ?? 0,
                idFournisseur: row.idFournisseur ?? null,
            })),
        });
    }
    catch (error) {
        console.error("Erreur getAllProduits :", error);
        res.status(500).json({ success: false, message: "Erreur lors de la récupération des produits." });
    }
}
export async function getProduitById(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID de produit invalide." });
        }
        const [row] = await db.select({ produit: produits, stock: stocks })
            .from(produits)
            .leftJoin(stocks, eq(stocks.idProduit, produits.id))
            .where(eq(produits.id, id))
            .limit(1);
        if (!row)
            return res.status(404).json({ success: false, message: "Produit introuvable." });
        return res.status(200).json({
            success: true,
            data: {
                ...row.produit,
                stock: row.stock?.quantite ?? 0,
                seuilMinimum: row.stock?.seuilMinimum ?? 0,
                idFournisseur: row.stock?.idFournisseur ?? null,
            },
        });
    }
    catch (error) {
        console.error("Erreur getProduitById :", error);
        return res.status(500).json({ success: false, message: "Erreur lors de la récupération du produit." });
    }
}
export async function createProduit(req, res) {
    try {
        const body = req.body;
        const designation = chaine(body.designation);
        const idCategorie = entierPositifOuZero(body.idCategorie, "La catégorie");
        const prixAchat = prixValide(body.prixAchat, "Le prix d'achat");
        const prixVente = prixValide(body.prixVente, "Le prix de vente");
        const stockInitial = entierPositifOuZero(body.stockInitial ?? body.stock ?? body.quantite, "Le stock initial") ?? 0;
        const seuilMinimum = entierPositifOuZero(body.seuilMinimum, "Le seuil minimum") ?? 0;
        const idFournisseur = entierPositifOuZero(body.idFournisseur, "Le fournisseur");
        if (!designation)
            return res.status(400).json({ success: false, message: "La désignation est obligatoire." });
        if (!idCategorie)
            return res.status(400).json({ success: false, message: "La catégorie est obligatoire." });
        if (prixAchat === null || prixVente === null) {
            return res.status(400).json({ success: false, message: "Les prix d'achat et de vente sont obligatoires." });
        }
        const [category] = await db.select().from(categories).where(eq(categories.id, idCategorie)).limit(1);
        if (!category)
            return res.status(400).json({ success: false, message: "La catégorie sélectionnée n'existe pas." });
        if (idFournisseur) {
            const [supplier] = await db.select().from(fournisseurs).where(eq(fournisseurs.id, idFournisseur)).limit(1);
            if (!supplier)
                return res.status(400).json({ success: false, message: "Le fournisseur sélectionné n'existe pas." });
        }
        const product = await db.transaction(async (tx) => {
            const [created] = await tx.insert(produits).values({
                designation,
                idCategorie,
                description: chaine(body.description),
                prixAchat,
                prixVente,
            }).returning();
            await tx.insert(stocks).values({
                idProduit: created.id,
                initial: stockInitial,
                quantite: stockInitial,
                seuilMinimum,
                idFournisseur,
            });
            if (stockInitial > 0) {
                await tx.insert(mouvementsStock).values({
                    idProduit: created.id,
                    type: "stock_initial",
                    quantite: stockInitial,
                    motif: "Création du produit",
                });
            }
            return created;
        });
        return res.status(201).json({ success: true, message: "Produit créé avec succès.", data: product });
    }
    catch (error) {
        return repondreErreur(res, error, "Erreur createProduit :");
    }
}
export async function updateProduit(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID de produit invalide." });
        }
        const body = req.body;
        const updates = { updatedAt: new Date() };
        if (body.designation !== undefined) {
            const designation = chaine(body.designation);
            if (!designation)
                return res.status(400).json({ success: false, message: "La désignation est obligatoire." });
            updates.designation = designation;
        }
        if (body.idCategorie !== undefined) {
            const idCategorie = entierPositifOuZero(body.idCategorie, "La catégorie");
            if (!idCategorie)
                return res.status(400).json({ success: false, message: "La catégorie est obligatoire." });
            updates.idCategorie = idCategorie;
        }
        if (body.description !== undefined)
            updates.description = chaine(body.description);
        if (body.prixAchat !== undefined)
            updates.prixAchat = prixValide(body.prixAchat, "Le prix d'achat") ?? "0.00";
        if (body.prixVente !== undefined) {
            const price = prixValide(body.prixVente, "Le prix de vente");
            if (price === null)
                return res.status(400).json({ success: false, message: "Le prix de vente est obligatoire." });
            updates.prixVente = price;
        }
        const result = await db.transaction(async (tx) => {
            const [updated] = await tx.update(produits).set(updates).where(eq(produits.id, id)).returning();
            if (!updated)
                return null;
            const stockValues = { updatedAt: new Date() };
            let stockWasUpdated = false;
            if (body.stockInitial !== undefined || body.stock !== undefined || body.quantite !== undefined) {
                const value = entierPositifOuZero(body.stockInitial ?? body.stock ?? body.quantite, "Le stock");
                if (value === null)
                    throw new InputError("Le stock doit être un entier positif ou nul.");
                stockValues.initial = value;
                stockValues.quantite = value;
                stockWasUpdated = true;
            }
            if (body.seuilMinimum !== undefined) {
                const value = entierPositifOuZero(body.seuilMinimum, "Le seuil minimum");
                if (value === null)
                    throw new InputError("Le seuil minimum doit être un entier positif ou nul.");
                stockValues.seuilMinimum = value;
                stockWasUpdated = true;
            }
            if (body.idFournisseur !== undefined) {
                stockValues.idFournisseur = body.idFournisseur
                    ? entierPositifOuZero(body.idFournisseur, "Le fournisseur")
                    : null;
                stockWasUpdated = true;
            }
            if (stockWasUpdated) {
                await tx.insert(stocks).values({
                    idProduit: id,
                    initial: stockValues.initial ?? 0,
                    quantite: stockValues.quantite ?? 0,
                    seuilMinimum: stockValues.seuilMinimum ?? 0,
                    idFournisseur: stockValues.idFournisseur ?? null,
                }).onConflictDoUpdate({
                    target: stocks.idProduit,
                    set: {
                        ...(stockValues.initial !== undefined && { initial: stockValues.initial }),
                        ...(stockValues.quantite !== undefined && { quantite: stockValues.quantite }),
                        ...(stockValues.seuilMinimum !== undefined && { seuilMinimum: stockValues.seuilMinimum }),
                        ...(stockValues.idFournisseur !== undefined && { idFournisseur: stockValues.idFournisseur }),
                        updatedAt: new Date(),
                    },
                });
            }
            return updated;
        });
        if (!result)
            return res.status(404).json({ success: false, message: "Produit introuvable." });
        return res.status(200).json({ success: true, message: "Produit modifié avec succès.", data: result });
    }
    catch (error) {
        return repondreErreur(res, error, "Erreur updateProduit :");
    }
}
export async function deleteProduit(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "ID de produit invalide." });
        }
        const motif = chaine(req.body?.motif);
        if (!motif) {
            return res.status(400).json({ success: false, message: "Le motif de suppression est obligatoire." });
        }
        const archived = await db.transaction(async (tx) => {
            const [result] = await tx.update(produits)
                .set({ archive: true, updatedAt: new Date() })
                .where(and(eq(produits.id, id), eq(produits.archive, false)))
                .returning();
            if (!result)
                return null;
            await tx.insert(journalActivite).values({
                idUtilisateur: requestUserId(req) ?? null,
                action: "produit.archive",
                details: { id, designation: result.designation, motif },
            });
            return result;
        });
        if (!archived) {
            return res.status(404).json({ success: false, message: "Produit introuvable ou déjà supprimé." });
        }
        return res.status(200).json({ success: true, message: "Produit supprimé avec succès.", data: archived });
    }
    catch (error) {
        return repondreErreur(res, error, "Erreur deleteProduit :");
    }
}
