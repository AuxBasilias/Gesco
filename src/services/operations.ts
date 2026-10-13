import { and, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import type { Request, RequestHandler, Response } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db/db";
import {
  categories,
  clientsTable,
  commandesFournisseurs,
  factures,
  fournisseurs,
  inventaires,
  journalActivite,
  lignesCommande,
  lignesFacture,
  lignesInventaire,
  lignesReception,
  lignesRetourVente,
  lignesVente,
  mouvementsStock,
  operationsCaisse,
  paiements,
  parametresBoutique,
  produits,
  receptions,
  retoursVente,
  sessionsCaisse,
  stocks,
  utilisateursTable,
  ventes,
} from "../db/schema";

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function endpoint(
  action: (req: Request, res: Response) => Promise<unknown>,
): RequestHandler {
  return async (req, res) => {
    try {
      await action(req, res);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.status).json({ success: false, message: error.message });
        return;
      }
      console.error("Erreur API métier :", error);
      res.status(500).json({ success: false, message: "Une erreur est survenue." });
    }
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function idParam(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ApiError(400, "Identifiant invalide.");
  }
  return id;
}

function positiveId(value: unknown, label: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, `${label} invalide.`);
  return id;
}

function amount(value: unknown, label: string, allowZero = true): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
    throw new ApiError(400, `${label} doit être un montant valide.`);
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function quantity(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, `${label} doit être un entier supérieur à zéro.`);
  }
  return parsed;
}

function linesFrom(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, "Ajoutez au moins une ligne.");
  }
  return value.map((item, index) => {
    const line = record(item);
    const idProduit = positiveId(line.idProduit ?? line.productId, `Produit de la ligne ${index + 1}`);
    const quantite = quantity(line.quantite ?? line.quantity, `Quantité de la ligne ${index + 1}`);
    const prixUnitaire = amount(
      line.prixUnitaire ?? line.unitPrice,
      `Prix de la ligne ${index + 1}`,
    );
    const remise = amount(line.remise ?? 0, `Remise de la ligne ${index + 1}`);
    if (remise > prixUnitaire * quantite) {
      throw new ApiError(400, `La remise de la ligne ${index + 1} dépasse son montant.`);
    }
    return {
      idProduit,
      quantite,
      prixUnitaire,
      remise,
      designation: String(line.designation ?? "").trim(),
      montantTotal: Math.round((prixUnitaire * quantite - remise) * 100) / 100,
    };
  });
}

function reference(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function requestUserId(req: Request): number | undefined {
  const userId = Number((req as Request & { user?: { id?: number } }).user?.id);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : undefined;
}

async function logActivity(
  tx: DbTransaction,
  req: Request,
  action: string,
  details: Record<string, unknown>,
) {
  await tx.insert(journalActivite).values({
    idUtilisateur: requestUserId(req) ?? null,
    action,
    details,
  });
}

async function storeStockMovement(
  tx: DbTransaction,
  req: Request,
  idProduit: number,
  type: string,
  quantite: number,
  ref: string | null,
  motif: string | null,
) {
  await tx.insert(mouvementsStock).values({
    idProduit,
    type,
    quantite,
    reference: ref,
    motif,
    idUtilisateur: requestUserId(req) ?? null,
  });
}

const getFactures = endpoint(async (req, res) => {
  const status = String(req.query.status ?? req.query.statut ?? "");
  const result = status
    ? await db.select().from(factures).where(eq(factures.statut, status)).orderBy(desc(factures.dateFacture))
    : await db.select().from(factures).orderBy(desc(factures.dateFacture));
  res.json(result);
});

const getFacture = endpoint(async (req, res) => {
  const id = idParam(req);
  const [facture] = await db.select().from(factures).where(eq(factures.id, id)).limit(1);
  if (!facture) throw new ApiError(404, "Facture introuvable.");
  const lignes = await db.select().from(lignesFacture).where(eq(lignesFacture.idFacture, id));
  res.json({ ...facture, lignes });
});

const createFacture = endpoint(async (req, res) => {
  const body = record(req.body);
  const idClient = positiveId(body.idClient, "Client");
  const sourceLines = body.lignes ?? body.lines;
  if (!Array.isArray(sourceLines) || sourceLines.length === 0) throw new ApiError(400, "Ajoutez au moins une ligne.");
  const lignes = sourceLines.map((item, index) => {
    const line = record(item);
    const quantiteLigne = quantity(line.quantite ?? line.quantity, `Quantité de la ligne ${index + 1}`);
    const prixUnitaireLigne = amount(line.prixUnitaire ?? line.unitPrice, `Prix de la ligne ${index + 1}`);
    const remise = amount(line.remise ?? 0, `Remise de la ligne ${index + 1}`);
    if (remise > prixUnitaireLigne * quantiteLigne) {
      throw new ApiError(400, `La remise de la ligne ${index + 1} dépasse son montant.`);
    }
    return {
      idProduit: line.idProduit ? positiveId(line.idProduit, `Produit de la ligne ${index + 1}`) : null,
      designation: String(line.designation ?? "Prestation").trim() || "Prestation",
      quantite: quantiteLigne,
      prixUnitaire: String(prixUnitaireLigne),
      montantTotal: String(Math.round((prixUnitaireLigne * quantiteLigne - remise) * 100) / 100),
    };
  });
  const montantHT = lignes.reduce((sum, line) => sum + Number(line.montantTotal), 0);
  const tauxTaxe = amount(body.tauxTaxe ?? 0, "Le taux de taxe");
  if (tauxTaxe > 100) throw new ApiError(400, "Le taux de taxe ne peut pas dépasser 100 %.");
  const tvaAppliquee = body.tvaAppliquee !== false;
  const montantTaxe = tvaAppliquee ? Math.round(montantHT * tauxTaxe) / 100 : 0;
  const montantTotal = montantHT + montantTaxe;
  const [result] = await db.transaction(async (tx) => {
    const [facture] = await tx.insert(factures).values({
      reference: String(body.reference || reference("FAC")),
      idClient,
      statut: String(body.statut ?? "brouillon"),
      dateFacture: body.dateFacture ? new Date(String(body.dateFacture)) : new Date(),
      dateEcheance: body.dateEcheance ? new Date(String(body.dateEcheance)) : null,
      montantHT: String(montantHT),
      montantTaxe: String(montantTaxe),
      tvaAppliquee,
      montantTotal: String(montantTotal),
      notes: body.notes ? String(body.notes) : null,
      donneesDocument: record(body.donneesDocument),
      idUtilisateur: requestUserId(req) ?? null,
    }).returning();
    await tx.insert(lignesFacture).values(lignes.map((line) => ({ ...line, idFacture: facture.id })));
    await logActivity(tx, req, "facture.creee", { id: facture.id, reference: facture.reference });
    return [facture];
  });
  res.status(201).json({ success: true, data: { ...result, lignes } });
});

const updateFacture = endpoint(async (req, res) => {
  const id = idParam(req);
  const body = record(record(req.body).facture ?? req.body);
  const updates: Partial<typeof factures.$inferInsert> = { updatedAt: new Date() };
  if (body.reference !== undefined) updates.reference = String(body.reference).trim();
  if (body.idClient !== undefined) updates.idClient = positiveId(body.idClient, "Client");
  if (body.statut !== undefined || body.status !== undefined) {
    updates.statut = String(body.statut ?? body.status);
  }
  if (body.dateFacture !== undefined) {
    const date = new Date(String(body.dateFacture));
    if (Number.isNaN(date.getTime())) throw new ApiError(400, "Date de facture invalide.");
    updates.dateFacture = date;
  }
  if (body.dateEcheance !== undefined) updates.dateEcheance = body.dateEcheance ? new Date(String(body.dateEcheance)) : null;
  if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes) : null;
  if (body.donneesDocument !== undefined) updates.donneesDocument = record(body.donneesDocument);
  let lines = undefined;
  if (body.lignes !== undefined) {
    if (!Array.isArray(body.lignes) || !body.lignes.length) throw new ApiError(400, "Ajoutez au moins une ligne.");
    lines = body.lignes.map((item, index) => {
      const line = record(item);
      const quantiteLigne = quantity(line.quantite, `Quantité de la ligne ${index + 1}`);
      const prixUnitaireLigne = amount(line.prixUnitaire, `Prix de la ligne ${index + 1}`);
      const remise = amount(line.remise ?? 0, `Remise de la ligne ${index + 1}`);
      if (remise > prixUnitaireLigne * quantiteLigne) {
        throw new ApiError(400, `La remise de la ligne ${index + 1} dépasse son montant.`);
      }
      return {
        idProduit: line.idProduit ? positiveId(line.idProduit, `Produit de la ligne ${index + 1}`) : null,
        designation: String(line.designation ?? "Prestation").trim() || "Prestation",
        quantite: quantiteLigne,
        prixUnitaire: String(prixUnitaireLigne),
        montantTotal: String(Math.round((prixUnitaireLigne * quantiteLigne - remise) * 100) / 100),
      };
    });
  }
  const updated = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(factures).where(eq(factures.id, id)).for("update");
    if (!current) throw new ApiError(404, "Facture introuvable.");
    let montantHT = Number(current.montantHT);
    let montantTaxe = Number(current.montantTaxe);
    let montantTotal = Number(current.montantTotal);
    const recomputeTotals = Boolean(lines || body.tvaAppliquee !== undefined || body.tauxTaxe !== undefined);
    if (recomputeTotals) {
      if (lines) montantHT = lines.reduce((sum, line) => sum + Number(line.montantTotal), 0);
      const metadata = record(body.donneesDocument ?? current.donneesDocument);
      const tauxTaxe = amount(body.tauxTaxe ?? metadata.tauxTaxe ?? 0, "Le taux de taxe");
      if (tauxTaxe > 100) throw new ApiError(400, "Le taux de taxe ne peut pas dépasser 100 %.");
      const tvaAppliquee = body.tvaAppliquee === undefined ? current.tvaAppliquee : body.tvaAppliquee !== false;
      montantTaxe = tvaAppliquee ? Math.round(montantHT * tauxTaxe) / 100 : 0;
      montantTotal = montantHT + montantTaxe;
      if (Number(current.montantPaye) > montantTotal) {
        throw new ApiError(409, "Le nouveau total ne peut pas être inférieur au montant déjà payé.");
      }
      updates.montantHT = String(montantHT);
      updates.montantTaxe = String(montantTaxe);
      updates.tvaAppliquee = tvaAppliquee;
      updates.montantTotal = String(montantTotal);
    }
    const [result] = await tx.update(factures).set(updates).where(eq(factures.id, id)).returning();
    if (lines) {
      await tx.delete(lignesFacture).where(eq(lignesFacture.idFacture, id));
      await tx.insert(lignesFacture).values(lines.map(line => ({ ...line, idFacture: id })));
    }
    await logActivity(tx, req, "facture.modifiee", { id });
    return result;
  });
  res.json({ success: true, data: { ...updated, lignes: lines } });
});

const deleteFacture = endpoint(async (req, res) => {
  const id = idParam(req);
  const [updated] = await db.update(factures)
    .set({ statut: "deleted", updatedAt: new Date() })
    .where(eq(factures.id, id))
    .returning();
  if (!updated) throw new ApiError(404, "Facture introuvable.");
  res.json({ success: true, data: updated });
});

const cleanupFactures = endpoint(async (_req, res) => {
  const trashed = await db.select({ id: factures.id }).from(factures).where(eq(factures.statut, "deleted"));
  if (trashed.length) {
    await db.transaction(async (tx) => {
      const ids = trashed.map((row) => row.id);
      await tx.delete(paiements).where(inArray(paiements.idFacture, ids));
      await tx.delete(factures).where(inArray(factures.id, ids));
    });
  }
  res.json({ success: true, deleted: trashed.length });
});

const factureStats = endpoint(async (_req, res) => {
  const rows = await db.select().from(factures);
  const active = rows.filter((row) => row.statut !== "deleted");
  res.json({
    total: active.length,
    montantTotal: active.reduce((sum, row) => sum + Number(row.montantTotal), 0),
    montantPaye: active.reduce((sum, row) => sum + Number(row.montantPaye), 0),
    enAttente: active.filter((row) => !["payee", "paid", "deleted"].includes(row.statut)).length,
  });
});

const factureRevenue = endpoint(async (req, res) => {
  const period = String(req.query.period ?? "month");
  const days = period === "week" ? 7 : period === "year" ? 365 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const rows = await db.select().from(factures)
    .where(and(gte(factures.dateFacture, since), inArray(factures.statut, ["payee", "paid"])));
  res.json({ period, revenue: rows.reduce((sum, row) => sum + Number(row.montantPaye), 0), count: rows.length });
});

const listPaiements = endpoint(async (_req, res) => {
  res.json(await db.select().from(paiements).orderBy(desc(paiements.datePaiement)));
});

const createPaiement = endpoint(async (req, res) => {
  const idFacture = idParam(req);
  const body = record(req.body);
  const montant = amount(body.montant, "Le paiement", false);
  const modePaiement = String(body.modePaiement ?? "").trim();
  if (!modePaiement) throw new ApiError(400, "Le mode de paiement est obligatoire.");

  const result = await db.transaction(async (tx) => {
    const [facture] = await tx.select().from(factures).where(eq(factures.id, idFacture)).limit(1);
    if (!facture || facture.statut === "deleted") throw new ApiError(404, "Facture introuvable.");
    const restant = Number(facture.montantTotal) - Number(facture.montantPaye);
    if (montant > restant) throw new ApiError(400, "Le paiement dépasse le solde de la facture.");
    const [payment] = await tx.insert(paiements).values({
      reference: reference("PAY"),
      idFacture,
      montant: String(montant),
      modePaiement,
      notes: body.notes ? String(body.notes) : null,
      idUtilisateur: requestUserId(req) ?? null,
    }).returning();
    const montantPaye = Math.round((Number(facture.montantPaye) + montant) * 100) / 100;
    await tx.update(factures).set({
      montantPaye: String(montantPaye),
      statut: montantPaye >= Number(facture.montantTotal) ? "payee" : "partiellement_payee",
      updatedAt: new Date(),
    }).where(eq(factures.id, idFacture));
    await logActivity(tx, req, "paiement.enregistre", { idFacture, montant });
    return payment;
  });
  res.status(201).json({ success: true, data: result });
});

const listVentes = endpoint(async (_req, res) => {
  const [sales, lines] = await Promise.all([
    db.select().from(ventes).orderBy(desc(ventes.dateVente)),
    db.select({ idVente: lignesVente.idVente, quantite: lignesVente.quantite }).from(lignesVente),
  ]);
  const articleCounts = new Map<number, number>();
  lines.forEach((line) => articleCounts.set(line.idVente, (articleCounts.get(line.idVente) ?? 0) + line.quantite));
  res.json(sales.map((sale) => ({ ...sale, articleCount: articleCounts.get(sale.id) ?? 0 })));
});

const getVente = endpoint(async (req, res) => {
  const id = idParam(req);
  const [vente] = await db.select().from(ventes).where(eq(ventes.id, id)).limit(1);
  if (!vente) throw new ApiError(404, "Vente introuvable.");
  const lignes = await db.select().from(lignesVente).where(eq(lignesVente.idVente, id));
  res.json({ ...vente, lignes });
});

const createFactureFromVente = endpoint(async (req, res) => {
  const id = idParam(req);
  const result = await db.transaction(async (tx) => {
    const [vente] = await tx.select().from(ventes).where(eq(ventes.id, id)).for("update");
    if (!vente) throw new ApiError(404, "Vente introuvable.");

    const [existing] = await tx.select().from(factures).where(eq(factures.idVente, id)).limit(1);
    if (existing) {
      const lignes = await tx.select().from(lignesFacture).where(eq(lignesFacture.idFacture, existing.id));
      return { facture: existing, lignes, created: false };
    }

    const venteLines = await tx.select().from(lignesVente).where(eq(lignesVente.idVente, id));
    if (venteLines.length === 0) throw new ApiError(409, "Cette vente ne contient aucune ligne.");

    const montantHT = Number(vente.montantHT);
    const [facture] = await tx.insert(factures).values({
      reference: reference("FAC"),
      idClient: vente.idClient,
      idVente: vente.id,
      statut: vente.statut === "annulee"
        ? "annulee"
        : Number(vente.montantPaye) >= Number(vente.montantTotal) ? "payee" : "partiellement_payee",
      dateFacture: vente.dateVente,
      montantHT: vente.montantHT,
      montantTaxe: vente.montantTaxe,
      tvaAppliquee: vente.tvaAppliquee,
      montantTotal: vente.montantTotal,
      montantPaye: vente.montantPaye,
      donneesDocument: {
        tauxTaxe: vente.tvaAppliquee && montantHT > 0 ? Number(vente.montantTaxe) / montantHT * 100 : 0,
        orderBanner: `Vente ${vente.reference}`,
        paymentCondition: `Paiement : ${vente.modePaiement}`,
      },
      notes: vente.notes,
      idUtilisateur: requestUserId(req) ?? vente.idUtilisateur,
    }).returning();
    const lignes = await tx.insert(lignesFacture).values(venteLines.map((line) => ({
      idFacture: facture.id,
      idProduit: line.idProduit,
      designation: line.designation,
      quantite: line.quantite,
      prixUnitaire: line.prixUnitaire,
      montantTotal: line.montantTotal,
    }))).returning();
    await logActivity(tx, req, "facture.creee_depuis_vente", {
      id: facture.id,
      reference: facture.reference,
      idVente: vente.id,
    });
    return { facture, lignes, created: true };
  });

  res.status(result.created ? 201 : 200).json({
    success: true,
    data: { ...result.facture, lignes: result.lignes },
  });
});

const createVente = endpoint(async (req, res) => {
  const body = record(req.body);
  const lignes = linesFrom(body.lignes ?? body.lines);
  const idSessionCaisse = positiveId(body.idSessionCaisse, "Session de caisse");
  const idClient = body.idClient ? positiveId(body.idClient, "Client") : null;
  const modePaiement = String(body.modePaiement ?? "");
  const supportedPaymentMethods = ["especes", "mobile_money", "carte", "virement", "cheque"];
  if (!supportedPaymentMethods.includes(modePaiement)) {
    throw new ApiError(400, "Le mode de paiement est invalide.");
  }
  const tauxTaxe = amount(body.tauxTaxe ?? 0, "Le taux de taxe");
  if (tauxTaxe > 100) throw new ApiError(400, "Le taux de taxe ne peut pas dépasser 100 %.");
  const tvaAppliquee = body.tvaAppliquee !== false;
  const vente = await db.transaction(async (tx) => {
    const [session] = await tx.select().from(sessionsCaisse)
      .where(eq(sessionsCaisse.id, idSessionCaisse)).for("update");
    if (!session) throw new ApiError(404, "Session de caisse introuvable.");
    if (session.statut !== "ouverte") throw new ApiError(409, "La session de caisse est clôturée.");

    const productRows = await tx.select().from(produits)
      .where(inArray(produits.id, lignes.map((line) => line.idProduit)))
      .for("update");
    const productsById = new Map(productRows.map((product) => [product.id, product]));
    for (const line of lignes) {
      const product = productsById.get(line.idProduit);
      if (!product) throw new ApiError(404, `Produit ${line.idProduit} introuvable.`);
      line.prixUnitaire = amount(product.prixVente, `Prix du produit ${line.idProduit}`);
      if (line.remise > line.prixUnitaire * line.quantite) {
        throw new ApiError(400, `La remise dépasse le montant de ${product.designation}.`);
      }
      line.designation = product.designation;
      line.montantTotal = Math.round((line.prixUnitaire * line.quantite - line.remise) * 100) / 100;
    }

    const stockRows = await tx.select().from(stocks)
      .where(inArray(stocks.idProduit, lignes.map((line) => line.idProduit)))
      .for("update");
    const disponible = new Map(stockRows.map((row) => [row.idProduit, row.quantite]));
    for (const line of lignes) {
      const stock = disponible.get(line.idProduit);
      if (stock === undefined) throw new ApiError(409, `Stock du produit ${line.idProduit} introuvable.`);
      const reste = stock - line.quantite;
      if (reste < 0) throw new ApiError(409, `Stock insuffisant pour le produit ${line.idProduit}.`);
      disponible.set(line.idProduit, reste);
    }
    if (idClient) {
      const [client] = await tx.select().from(clientsTable).where(eq(clientsTable.id, idClient)).for("update");
      if (!client) throw new ApiError(404, "Client introuvable.");
    }
    const montantHT = Math.round(lignes.reduce((sum, line) => sum + line.montantTotal, 0) * 100) / 100;
    const montantTaxe = tvaAppliquee ? Math.round((montantHT * tauxTaxe / 100) * 100) / 100 : 0;
    const montantTotal = Math.round((montantHT + montantTaxe) * 100) / 100;
    const montantPaye = amount(body.montantPaye ?? montantTotal, "Montant payé");
    if (montantPaye > montantTotal) throw new ApiError(400, "Le paiement dépasse le montant de la vente.");
    if (modePaiement === "especes" && body.montantRecu !== undefined) {
      const montantRecu = amount(body.montantRecu, "Montant reçu");
      if (montantRecu < montantPaye) throw new ApiError(400, "Le montant reçu est inférieur au montant payé.");
    }
    const [created] = await tx.insert(ventes).values({
      reference: String(body.reference ?? reference("VTE")),
      idClient,
      idSessionCaisse,
      statut: montantPaye >= montantTotal ? "payee" : "partiellement_payee",
      montantHT: String(montantHT),
      montantTaxe: String(montantTaxe),
      tvaAppliquee,
      montantTotal: String(montantTotal),
      montantPaye: String(montantPaye),
      modePaiement,
      notes: body.notes ? String(body.notes) : null,
      idUtilisateur: requestUserId(req) ?? null,
    }).returning();
    await tx.insert(lignesVente).values(lignes.map((line) => ({
      idVente: created.id,
      idProduit: line.idProduit,
      designation: line.designation || `Produit ${line.idProduit}`,
      quantite: line.quantite,
      prixUnitaire: String(line.prixUnitaire),
      remise: String(line.remise),
      montantTotal: String(line.montantTotal),
    })));
    for (const line of lignes) {
      const reste = disponible.get(line.idProduit)!;
      await tx.update(stocks).set({ quantite: reste, updatedAt: new Date() })
        .where(eq(stocks.idProduit, line.idProduit));
      await storeStockMovement(tx, req, line.idProduit, "vente", -line.quantite, created.reference, null);
    }
    await tx.insert(operationsCaisse).values({
      idSessionCaisse,
      idVente: created.id,
      type: "encaissement",
      modePaiement,
      montant: String(montantPaye),
      idUtilisateur: requestUserId(req) ?? null,
    });
    await tx.update(sessionsCaisse).set({
      montantAttendu: String(Number(session.montantAttendu) + (modePaiement === "especes" ? montantPaye : 0)),
    }).where(eq(sessionsCaisse.id, idSessionCaisse));
    if (created.idClient) {
      const [client] = await tx.select().from(clientsTable).where(eq(clientsTable.id, created.idClient)).limit(1);
      await tx.update(clientsTable).set({
        totalAchats: String(Number(client.totalAchats) + montantTotal),
        soldeDu: String(Number(client.soldeDu) + montantTotal - montantPaye),
        dernierAchat: new Date(),
      }).where(eq(clientsTable.id, created.idClient));
    }
    await logActivity(tx, req, "vente.creee", { id: created.id, reference: created.reference });
    return created;
  });
  res.status(201).json({ success: true, data: vente });
});

const cancelVente = endpoint(async (req, res) => {
  const id = idParam(req);
  const updated = await db.transaction(async (tx) => {
    const [vente] = await tx.select().from(ventes).where(eq(ventes.id, id)).for("update");
    if (!vente) throw new ApiError(404, "Vente introuvable.");
    if (vente.statut === "annulee") throw new ApiError(409, "Cette vente est déjà annulée.");
    const [session] = vente.idSessionCaisse
      ? await tx.select().from(sessionsCaisse).where(eq(sessionsCaisse.id, vente.idSessionCaisse)).for("update")
      : [];
    if (session && session.statut !== "ouverte") {
      throw new ApiError(409, "La caisse est clôturée. Enregistrez un retour plutôt que d'annuler cette vente.");
    }
    const lines = await tx.select().from(lignesVente).where(eq(lignesVente.idVente, id));
    for (const line of lines) {
      const [stock] = await tx.select().from(stocks).where(eq(stocks.idProduit, line.idProduit)).for("update");
      if (!stock) throw new ApiError(409, "Stock du produit introuvable.");
      await tx.update(stocks).set({ quantite: stock.quantite + line.quantite, updatedAt: new Date() })
        .where(eq(stocks.id, stock.id));
      await storeStockMovement(tx, req, line.idProduit, "annulation_vente", line.quantite, vente.reference, null);
    }
    if (session && Number(vente.montantPaye) > 0) {
      await tx.insert(operationsCaisse).values({
        idSessionCaisse: session.id,
        idVente: vente.id,
        type: "decaissement",
        modePaiement: vente.modePaiement ?? "especes",
        montant: String(vente.montantPaye),
        motif: `Remboursement de l'annulation ${vente.reference}`,
        idUtilisateur: requestUserId(req) ?? null,
      });
      if (vente.modePaiement === "especes") {
        await tx.update(sessionsCaisse).set({
          montantAttendu: String(Number(session.montantAttendu) - Number(vente.montantPaye)),
        }).where(eq(sessionsCaisse.id, session.id));
      }
    }
    if (vente.idClient) {
      const [client] = await tx.select().from(clientsTable).where(eq(clientsTable.id, vente.idClient)).for("update");
      if (client) {
        await tx.update(clientsTable).set({
          totalAchats: String(Math.max(0, Number(client.totalAchats) - Number(vente.montantTotal))),
          soldeDu: String(Math.max(0, Number(client.soldeDu) - (Number(vente.montantTotal) - Number(vente.montantPaye)))),
        }).where(eq(clientsTable.id, client.id));
      }
    }
    const [result] = await tx.update(ventes).set({ statut: "annulee" }).where(eq(ventes.id, id)).returning();
    await tx.update(factures)
      .set({ statut: "annulee", updatedAt: new Date() })
      .where(eq(factures.idVente, id));
    await logActivity(tx, req, "vente.annulee", { id });
    return result;
  });
  res.json({ success: true, data: updated });
});

const openCashSession = endpoint(async (req, res) => {
  const body = record(req.body);
  const fondOuverture = amount(body.fondOuverture ?? 0, "Le fond de caisse");
  const result = await db.transaction(async (tx) => {
    const [open] = await tx.select().from(sessionsCaisse).where(eq(sessionsCaisse.statut, "ouverte")).limit(1);
    if (open) throw new ApiError(409, "Une session de caisse est déjà ouverte.");
    const [session] = await tx.insert(sessionsCaisse).values({
      reference: reference("CSE"),
      idUtilisateur: requestUserId(req) ?? null,
      fondOuverture: String(fondOuverture),
      montantAttendu: String(fondOuverture),
    }).returning();
    await logActivity(tx, req, "caisse.ouverte", { id: session.id });
    return session;
  });
  res.status(201).json({ success: true, data: result });
});

const listCashSessions = endpoint(async (_req, res) => {
  res.json(await db.select().from(sessionsCaisse).orderBy(desc(sessionsCaisse.dateOuverture)));
});

const closeCashSession = endpoint(async (req, res) => {
  const id = idParam(req);
  const compte = amount(record(req.body).montantCompte, "Le montant compté");
  const result = await db.transaction(async (tx) => {
    const [session] = await tx.select().from(sessionsCaisse).where(eq(sessionsCaisse.id, id)).for("update");
    if (!session) throw new ApiError(404, "Session de caisse introuvable.");
    if (session.statut !== "ouverte") throw new ApiError(409, "Cette session est déjà clôturée.");
    const ecart = Math.round((compte - Number(session.montantAttendu)) * 100) / 100;
    const [closed] = await tx.update(sessionsCaisse).set({
      statut: "fermee",
      dateFermeture: new Date(),
      montantCompte: String(compte),
      ecart: String(ecart),
    }).where(eq(sessionsCaisse.id, id)).returning();
    await logActivity(tx, req, "caisse.fermee", { id, ecart });
    return closed;
  });
  res.json({ success: true, data: result });
});

const stockList = endpoint(async (_req, res) => {
  const rows = await db.select({
    id: produits.id,
    designation: produits.designation,
    numeroSerie: produits.numeroSerie,
    idCategorie: produits.idCategorie,
    codeBarres: produits.codeBarres,
    prixAchat: produits.prixAchat,
    prixVente: produits.prixVente,
    stock: stocks.quantite,
    seuilMinimum: stocks.seuilMinimum,
    idFournisseur: stocks.idFournisseur,
  }).from(produits).leftJoin(stocks, eq(stocks.idProduit, produits.id));
  res.json(rows.map((row) => ({
    ...row,
    stock: row.stock ?? 0,
    seuilMinimum: row.seuilMinimum ?? 0,
    idFournisseur: row.idFournisseur ?? null,
  })));
});

const createStockMovement = endpoint(async (req, res) => {
  const body = record(req.body);
  const idProduit = positiveId(body.idProduit, "Produit");
  const qte = quantity(body.quantite, "Quantité");
  const type = String(body.type ?? "");
  const direction = ["entree", "retour", "ajustement_positif"].includes(type) ? 1
    : ["sortie", "perte", "ajustement_negatif"].includes(type) ? -1 : 0;
  if (!direction) throw new ApiError(400, "Type de mouvement de stock invalide.");
  const result = await db.transaction(async (tx) => {
    const [stock] = await tx.select().from(stocks).where(eq(stocks.idProduit, idProduit)).for("update");
    if (!stock) throw new ApiError(404, "Stock du produit introuvable.");
    const updatedQuantity = stock.quantite + direction * qte;
    if (updatedQuantity < 0) throw new ApiError(409, "Le stock ne peut pas devenir négatif.");
    await tx.update(stocks).set({ quantite: updatedQuantity, updatedAt: new Date() })
      .where(eq(stocks.id, stock.id));
    await storeStockMovement(tx, req, idProduit, type, direction * qte, null, body.motif ? String(body.motif) : null);
    await logActivity(tx, req, "stock.mouvement", { idProduit, type, quantite: qte });
    return { idProduit, type, quantite: direction * qte, stock: updatedQuantity };
  });
  res.status(201).json({ success: true, data: result });
});

const listStockMovements = endpoint(async (_req, res) => {
  res.json(await db.select().from(mouvementsStock).orderBy(desc(mouvementsStock.createdAt)));
});

const createOrder = endpoint(async (req, res) => {
  const body = record(req.body);
  const idFournisseur = positiveId(body.idFournisseur, "Fournisseur");
  const lignes = linesFrom(body.lignes ?? body.lines);
  const montantTotal = lignes.reduce((sum, line) => sum + line.montantTotal, 0);
  const result = await db.transaction(async (tx) => {
    const [supplier] = await tx.select().from(fournisseurs)
      .where(eq(fournisseurs.id, idFournisseur)).for("update");
    if (!supplier) throw new ApiError(404, "Fournisseur introuvable.");
    const productRows = await tx.select().from(produits)
      .where(inArray(produits.id, lignes.map((line) => line.idProduit)));
    const productsById = new Map(productRows.map((product) => [product.id, product]));
    for (const line of lignes) {
      const product = productsById.get(line.idProduit);
      if (!product) throw new ApiError(404, `Produit ${line.idProduit} introuvable.`);
      line.designation = product.designation;
    }
    const [order] = await tx.insert(commandesFournisseurs).values({
      reference: String(body.reference ?? reference("ACH")),
      idFournisseur,
      statut: String(body.statut ?? "envoyee"),
      dateLivraisonPrevue: body.dateLivraisonPrevue ? new Date(String(body.dateLivraisonPrevue)) : null,
      montantHT: String(montantTotal),
      montantTotal: String(montantTotal),
      notes: body.notes ? String(body.notes) : null,
      idUtilisateur: requestUserId(req) ?? null,
    }).returning();
    await tx.insert(lignesCommande).values(lignes.map((line) => ({
      idCommande: order.id,
      idProduit: line.idProduit,
      designation: line.designation || `Produit ${line.idProduit}`,
      quantite: line.quantite,
      prixUnitaire: String(line.prixUnitaire),
      montantTotal: String(line.montantTotal),
    })));
    await logActivity(tx, req, "approvisionnement.commande_creee", { id: order.id });
    return order;
  });
  res.status(201).json({ success: true, data: result });
});

const getOrder = endpoint(async (req, res) => {
  const id = idParam(req);
  const [order] = await db.select().from(commandesFournisseurs).where(eq(commandesFournisseurs.id, id)).limit(1);
  if (!order) throw new ApiError(404, "Commande fournisseur introuvable.");
  const [supplier, lines] = await Promise.all([
    db.select().from(fournisseurs).where(eq(fournisseurs.id, order.idFournisseur)).limit(1),
    db.select().from(lignesCommande).where(eq(lignesCommande.idCommande, id)),
  ]);
  res.json({ ...order, fournisseur: supplier[0] ?? null, lignes: lines });
});

const listOrders = endpoint(async (_req, res) => {
  const [orders, suppliers, lines] = await Promise.all([
    db.select().from(commandesFournisseurs).orderBy(desc(commandesFournisseurs.dateCommande)),
    db.select({ id: fournisseurs.id, nom: fournisseurs.nom }).from(fournisseurs),
    db.select({ idCommande: lignesCommande.idCommande }).from(lignesCommande),
  ]);
  const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.nom]));
  const lineCounts = new Map<number, number>();
  lines.forEach(({ idCommande }) => lineCounts.set(idCommande, (lineCounts.get(idCommande) ?? 0) + 1));
  res.json(orders.map((order) => ({
    ...order,
    idFournisseurLabel: supplierNames.get(order.idFournisseur) ?? `Fournisseur ${order.idFournisseur}`,
    articleCount: lineCounts.get(order.id) ?? 0,
  })));
});

const receiveOrder = endpoint(async (req, res) => {
  const idCommande = idParam(req);
  const body = record(req.body);
  const lignes = body.lignes;
  if (!Array.isArray(lignes) || lignes.length === 0) {
    throw new ApiError(400, "Ajoutez les quantités réceptionnées.");
  }
  const lineIds = lignes.map((item) => positiveId(record(item).idLigneCommande, "Ligne de commande"));
  if (new Set(lineIds).size !== lineIds.length) {
    throw new ApiError(400, "Une même ligne de commande ne peut apparaître qu'une fois par réception.");
  }
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(commandesFournisseurs).where(eq(commandesFournisseurs.id, idCommande)).for("update");
    if (!order || order.statut === "annulee") throw new ApiError(404, "Commande fournisseur introuvable.");
    const orderLines = await tx.select().from(lignesCommande).where(eq(lignesCommande.idCommande, idCommande)).for("update");
    const linesById = new Map(orderLines.map((line) => [line.id, line]));
    const receiptRef = reference("REC");
    const [receipt] = await tx.insert(receptions).values({
      reference: receiptRef,
      idCommande,
      notes: body.notes ? String(body.notes) : null,
      idUtilisateur: requestUserId(req) ?? null,
    }).returning();
    for (const item of lignes) {
      const lineBody = record(item);
      const idLigneCommande = positiveId(lineBody.idLigneCommande, "Ligne de commande");
      const qte = quantity(lineBody.quantiteRecue, "Quantité réceptionnée");
      const orderLine = linesById.get(idLigneCommande);
      if (!orderLine || orderLine.quantiteRecue + qte > orderLine.quantite) {
        throw new ApiError(400, "La quantité réceptionnée dépasse la quantité commandée.");
      }
      await tx.update(lignesCommande).set({ quantiteRecue: orderLine.quantiteRecue + qte })
        .where(eq(lignesCommande.id, idLigneCommande));
      await tx.insert(lignesReception).values({ idReception: receipt.id, idLigneCommande, quantiteRecue: qte });
      const [stock] = await tx.select().from(stocks).where(eq(stocks.idProduit, orderLine.idProduit)).for("update");
      if (!stock) {
        await tx.insert(stocks).values({
          idProduit: orderLine.idProduit,
          initial: 0,
          quantite: qte,
          idFournisseur: order.idFournisseur,
        });
      } else {
        await tx.update(stocks).set({
          quantite: stock.quantite + qte,
          idFournisseur: order.idFournisseur,
          updatedAt: new Date(),
        }).where(eq(stocks.id, stock.id));
      }
      await storeStockMovement(tx, req, orderLine.idProduit, "reception", qte, receiptRef, null);
    }
    const updatedLines = await tx.select().from(lignesCommande).where(eq(lignesCommande.idCommande, idCommande));
    const complete = updatedLines.every((line) => line.quantiteRecue >= line.quantite);
    const someReceived = updatedLines.some((line) => line.quantiteRecue > 0);
    await tx.update(commandesFournisseurs).set({
      statut: complete ? "recue" : someReceived ? "partielle" : order.statut,
      updatedAt: new Date(),
    }).where(eq(commandesFournisseurs.id, idCommande));
    await logActivity(tx, req, "approvisionnement.reception", { idCommande, idReception: receipt.id });
    return receipt;
  });
  res.status(201).json({ success: true, data: result });
});

const createReturn = endpoint(async (req, res) => {
  const body = record(req.body);
  const idVente = positiveId(body.idVente, "Vente");
  const lignes = body.lignes;
  if (!Array.isArray(lignes) || !lignes.length) throw new ApiError(400, "Ajoutez au moins un produit à retourner.");
  const result = await db.transaction(async (tx) => {
    const [sale] = await tx.select().from(ventes).where(eq(ventes.id, idVente)).for("update");
    if (!sale || sale.statut === "annulee") throw new ApiError(404, "Vente introuvable.");
    const saleLines = await tx.select().from(lignesVente).where(eq(lignesVente.idVente, idVente));
    const [retour] = await tx.insert(retoursVente).values({
      reference: reference("RET"),
      idVente,
      motif: body.motif ? String(body.motif) : null,
      idUtilisateur: requestUserId(req) ?? null,
    }).returning();
    let total = 0;
    for (const item of lignes) {
      const lineBody = record(item);
      const idLigneVente = positiveId(lineBody.idLigneVente, "Ligne de vente");
      const qte = quantity(lineBody.quantite, "Quantité retournée");
      const saleLine = saleLines.find((line) => line.id === idLigneVente);
      if (!saleLine) throw new ApiError(400, "Produit ne faisant pas partie de cette vente.");
      const previousReturns = await tx.select().from(lignesRetourVente).where(eq(lignesRetourVente.idLigneVente, idLigneVente));
      const alreadyReturned = previousReturns.reduce((sum, line) => sum + line.quantite, 0);
      if (alreadyReturned + qte > saleLine.quantite) throw new ApiError(409, "La quantité retournée dépasse la quantité achetée.");
      const lineAmount = Math.round(Number(saleLine.prixUnitaire) * qte * 100) / 100;
      total += lineAmount;
      await tx.insert(lignesRetourVente).values({ idRetour: retour.id, idLigneVente, quantite: qte, montant: String(lineAmount) });
      const [stock] = await tx.select().from(stocks).where(eq(stocks.idProduit, saleLine.idProduit)).for("update");
      if (!stock) throw new ApiError(409, "Stock du produit introuvable.");
      await tx.update(stocks).set({ quantite: stock.quantite + qte, updatedAt: new Date() }).where(eq(stocks.id, stock.id));
      await storeStockMovement(tx, req, saleLine.idProduit, "retour", qte, retour.reference, String(body.motif ?? ""));
    }
    const [updated] = await tx.update(retoursVente).set({ montantRembourse: String(total) })
      .where(eq(retoursVente.id, retour.id)).returning();
    await logActivity(tx, req, "vente.retour", { idVente, idRetour: retour.id, montant: total });
    return updated;
  });
  res.status(201).json({ success: true, data: result });
});

const listReturns = endpoint(async (_req, res) => {
  res.json(await db.select().from(retoursVente).orderBy(desc(retoursVente.dateRetour)));
});

const createInventory = endpoint(async (req, res) => {
  const body = record(req.body);
  const result = await db.transaction(async (tx) => {
    const [inventory] = await tx.insert(inventaires).values({
      reference: String(body.reference ?? reference("INV")),
      notes: body.notes ? String(body.notes) : null,
      idUtilisateur: requestUserId(req) ?? null,
    }).returning();
    const products = await tx.select().from(stocks);
    if (products.length) {
      await tx.insert(lignesInventaire).values(products.map((stock) => ({
        idInventaire: inventory.id,
        idProduit: stock.idProduit,
        quantiteTheorique: stock.quantite,
      })));
    }
    await logActivity(tx, req, "stock.inventaire_cree", { id: inventory.id });
    return inventory;
  });
  res.status(201).json({ success: true, data: result });
});

const listInventories = endpoint(async (_req, res) => {
  res.json(await db.select().from(inventaires).orderBy(desc(inventaires.dateInventaire)));
});

const countInventory = endpoint(async (req, res) => {
  const idInventaire = idParam(req);
  const body = record(req.body);
  const lignes = body.lignes;
  if (!Array.isArray(lignes) || !lignes.length) throw new ApiError(400, "Ajoutez les quantités comptées.");
  const result = await db.transaction(async (tx) => {
    const [inventory] = await tx.select().from(inventaires).where(eq(inventaires.id, idInventaire)).for("update");
    if (!inventory) throw new ApiError(404, "Inventaire introuvable.");
    if (inventory.statut !== "en_cours") throw new ApiError(409, "Cet inventaire est déjà clôturé.");
    for (const item of lignes) {
      const lineBody = record(item);
      const idProduit = positiveId(lineBody.idProduit, "Produit");
      const qte = Number(lineBody.quantiteComptee);
      if (!Number.isSafeInteger(qte) || qte < 0) throw new ApiError(400, "La quantité comptée doit être un entier positif ou nul.");
      const [line] = await tx.select().from(lignesInventaire).where(and(
        eq(lignesInventaire.idInventaire, idInventaire),
        eq(lignesInventaire.idProduit, idProduit),
      )).for("update");
      if (!line) throw new ApiError(400, "Produit absent de cet inventaire.");
      const ecart = qte - line.quantiteTheorique;
      await tx.update(lignesInventaire).set({ quantiteComptee: qte, ecart })
        .where(eq(lignesInventaire.id, line.id));
    }
    const allLines = await tx.select().from(lignesInventaire).where(eq(lignesInventaire.idInventaire, idInventaire));
    const complete = allLines.every((line) => line.quantiteComptee !== null);
    if (body.cloturer === true && !complete) throw new ApiError(409, "Comptez tous les produits avant de clôturer l'inventaire.");
    if (body.cloturer === true) {
      for (const line of allLines) {
        const delta = line.quantiteComptee! - line.quantiteTheorique;
        if (!delta) continue;
        await tx.update(stocks).set({ quantite: line.quantiteComptee!, updatedAt: new Date() })
          .where(eq(stocks.idProduit, line.idProduit));
        await storeStockMovement(tx, req, line.idProduit, "inventaire", delta, inventory.reference, null);
      }
      await tx.update(inventaires).set({ statut: "termine" }).where(eq(inventaires.id, idInventaire));
    }
    await logActivity(tx, req, "stock.inventaire_compte", { idInventaire, cloture: body.cloturer === true });
    return { idInventaire, cloture: body.cloturer === true };
  });
  res.json({ success: true, data: result });
});

const storeSettings = endpoint(async (req, res) => {
  const body = record(req.body);
  const current = await db.select().from(parametresBoutique).limit(1);
  const data = {
    nom: String(body.nom ?? "").trim(),
    adresse: body.adresse ? String(body.adresse) : null,
    telephone: body.telephone ? String(body.telephone) : null,
    email: body.email ? String(body.email) : null,
    nif: body.nif ? String(body.nif) : null,
    devise: String(body.devise ?? "XOF"),
    tauxTaxe: String(amount(body.tauxTaxe ?? 0, "Le taux de taxe")),
    prefixeFacture: String(body.prefixeFacture ?? "FAC"),
    updatedAt: new Date(),
  };
  if (!data.nom) throw new ApiError(400, "Le nom de la boutique est obligatoire.");
  const result = current.length
    ? await db.update(parametresBoutique).set(data).where(eq(parametresBoutique.id, current[0].id)).returning()
    : await db.insert(parametresBoutique).values(data).returning();
  res.json({ success: true, data: result[0] });
});

const getSettings = endpoint(async (_req, res) => {
  const [settings] = await db.select().from(parametresBoutique).limit(1);
  res.json(settings ?? null);
});

const dashboard = endpoint(async (req, res) => {
  const days = Number(req.query.days ?? 7);
  if (![7, 30, 90].includes(days)) {
    throw new ApiError(400, "La période du tableau de bord doit être de 7, 30 ou 90 jours.");
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodStart = new Date(startOfToday);
  periodStart.setDate(periodStart.getDate() - days + 1);
  const previousPeriodStart = new Date(periodStart);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - days);
  const [clientRows, productRows, categoryRows, saleRows, recentSalesRows, invoiceRows, stockRows, returnRows] = await Promise.all([
    db.select().from(clientsTable),
    db.select().from(produits),
    db.select().from(categories),
    db.select().from(ventes).where(and(
      gte(ventes.dateVente, previousPeriodStart),
      lte(ventes.dateVente, now),
    )),
    db.select().from(ventes)
      .where(ne(ventes.statut, "annulee"))
      .orderBy(desc(ventes.dateVente))
      .limit(8),
    db.select().from(factures),
    db.select().from(stocks),
    db.select().from(retoursVente).where(and(
      gte(retoursVente.dateRetour, startOfToday),
      lte(retoursVente.dateRetour, now),
    )),
  ]);

  const isCompletedSale = (sale: typeof saleRows[number]) => sale.statut !== "annulee";
  const salesToday = saleRows.filter((sale) =>
    isCompletedSale(sale) && sale.dateVente >= startOfToday && sale.dateVente <= now,
  );
  const periodSales = saleRows.filter((sale) =>
    isCompletedSale(sale) && sale.dateVente >= periodStart && sale.dateVente <= now,
  );
  const previousPeriodSales = saleRows.filter((sale) =>
    isCompletedSale(sale) && sale.dateVente >= previousPeriodStart && sale.dateVente < periodStart,
  );
  const periodSaleIds = new Set(periodSales.map((sale) => sale.id));
  const saleLineRows = periodSaleIds.size
    ? await db.select().from(lignesVente).where(inArray(lignesVente.idVente, [...periodSaleIds]))
    : [];
  const revenue = (sales: typeof saleRows) =>
    sales.reduce((sum, sale) => sum + Number(sale.montantPaye), 0);
  const currentRevenue = revenue(periodSales);
  const previousRevenue = revenue(previousPeriodSales);
  const variationChiffreAffaires = previousRevenue > 0
    ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 10000) / 100
    : null;

  const clientNames = new Map(clientRows.map((client) => [client.id, client.nom]));
  const productById = new Map(productRows.map((product) => [product.id, product]));
  const categoryNames = new Map(categoryRows.map((category) => [category.id, category.label]));
  const dailyStats = new Map<string, { date: string; label: string; chiffreAffaires: number; ventes: number }>();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(periodStart);
    date.setDate(date.getDate() + offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    dailyStats.set(key, {
      date: key,
      label: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date),
      chiffreAffaires: 0,
      ventes: 0,
    });
  }
  for (const sale of periodSales) {
    const date = sale.dateVente;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const stats = dailyStats.get(key);
    if (stats) {
      stats.chiffreAffaires += Number(sale.montantPaye);
      stats.ventes += 1;
    }
  }

  const productSales = new Map<number, { quantite: number; chiffreAffaires: number }>();
  for (const line of saleLineRows) {
    if (!periodSaleIds.has(line.idVente)) continue;
    const totals = productSales.get(line.idProduit) ?? { quantite: 0, chiffreAffaires: 0 };
    totals.quantite += line.quantite;
    totals.chiffreAffaires += Number(line.montantTotal);
    productSales.set(line.idProduit, totals);
  }

  const lowStockProducts = stockRows
    .filter((stock) => stock.quantite <= stock.seuilMinimum)
    .map((stock) => ({
      idProduit: stock.idProduit,
      designation: productById.get(stock.idProduit)?.designation ?? `Produit ${stock.idProduit}`,
      quantite: stock.quantite,
      seuilMinimum: stock.seuilMinimum,
      numeroSerie: productById.get(stock.idProduit)?.numeroSerie ?? null,
    }))
    .sort((a, b) => a.quantite - b.quantite)
    .slice(0, 8);
  const topProducts = [...productSales.entries()]
    .map(([idProduit, totals]) => {
      const product = productById.get(idProduit);
      return {
        idProduit,
        designation: product?.designation ?? `Produit ${idProduit}`,
        categorie: product ? categoryNames.get(product.idCategorie) ?? "Sans catégorie" : "Sans catégorie",
        ...totals,
      };
    })
    .sort((a, b) => b.quantite - a.quantite)
    .slice(0, 5);
  const stockValue = stockRows.reduce((sum, stock) => {
    const product = productById.get(stock.idProduit);
    return sum + stock.quantite * Number(product?.prixAchat ?? 0);
  }, 0);
  const unpaidInvoices = invoiceRows.filter((invoice) => Number(invoice.montantTotal) > Number(invoice.montantPaye));
  const returnsToday = returnRows.filter((item) => item.statut !== "annule");

  res.json({
    clients: clientRows.length,
    produits: productRows.length,
    ventesJour: salesToday.length,
    chiffreAffairesJour: revenue(salesToday),
    retoursJour: returnsToday.length,
    chiffreAffairesPeriode: currentRevenue,
    ventesPeriode: periodSales.length,
    variationChiffreAffaires,
    periodeJours: days,
    facturesImpayees: unpaidInvoices.length,
    montantImpayes: unpaidInvoices.reduce(
      (sum, invoice) => sum + Math.max(0, Number(invoice.montantTotal) - Number(invoice.montantPaye)),
      0,
    ),
    produitsSousSeuil: stockRows.filter((stock) => stock.quantite <= stock.seuilMinimum).length,
    produitsEnRupture: stockRows.filter((stock) => stock.quantite === 0).length,
    quantiteEnStock: stockRows.reduce((sum, stock) => sum + stock.quantite, 0),
    valeurStock: stockValue,
    ventesParJour: [...dailyStats.values()],
    meilleuresVentes: topProducts,
    stocksFaibles: lowStockProducts,
    ventesRecentes: recentSalesRows.map((sale) => ({
        ...sale,
        nomClient: sale.idClient ? clientNames.get(sale.idClient) ?? `Client ${sale.idClient}` : "Client comptoir",
    })),
  });
});

const report = endpoint(async (req, res) => {
  const start = req.query.debut ? new Date(String(req.query.debut)) : new Date(new Date().getFullYear(), 0, 1);
  const end = req.query.fin ? new Date(String(req.query.fin)) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new ApiError(400, "Période de rapport invalide.");
  }
  const saleRows = await db.select().from(ventes).where(and(gte(ventes.dateVente, start), lte(ventes.dateVente, end)));
  const customerRows = await db.select().from(clientsTable).orderBy(desc(clientsTable.totalAchats)).limit(10);
  const completedSales = saleRows.filter((sale) => sale.statut !== "annulee");
  res.json({
    debut: start,
    fin: end,
    ventes: completedSales.length,
    chiffreAffaires: completedSales.reduce((sum, sale) => sum + Number(sale.montantPaye), 0),
    clients: customerRows,
  });
});

const listActivity = endpoint(async (_req, res) => {
  res.json(await db.select().from(journalActivite).orderBy(desc(journalActivite.createdAt)).limit(200));
});

const createStockForProduct = endpoint(async (req, res) => {
  const idProduit = idParam(req);
  const body = record(req.body);
  const initial = Number(body.initial ?? body.quantite ?? 0);
  const seuilMinimum = Number(body.seuilMinimum ?? 0);
  if (!Number.isSafeInteger(initial) || initial < 0 || !Number.isSafeInteger(seuilMinimum) || seuilMinimum < 0) {
    throw new ApiError(400, "Les quantités de stock doivent être des entiers positifs ou nuls.");
  }
  const [product] = await db.select().from(produits).where(eq(produits.id, idProduit)).limit(1);
  if (!product) throw new ApiError(404, "Produit introuvable.");
  const result = await db.transaction(async (tx) => {
    const [stock] = await tx.insert(stocks).values({
      idProduit,
      initial,
      quantite: initial,
      seuilMinimum,
      idFournisseur: body.idFournisseur ? positiveId(body.idFournisseur, "Fournisseur") : null,
    }).onConflictDoUpdate({
      target: stocks.idProduit,
      set: {
        initial,
        quantite: initial,
        seuilMinimum,
        idFournisseur: body.idFournisseur ? positiveId(body.idFournisseur, "Fournisseur") : null,
        updatedAt: new Date(),
      },
    }).returning();
    if (initial) await storeStockMovement(tx, req, idProduit, "stock_initial", initial, null, null);
    return stock;
  });
  res.status(200).json({ success: true, data: result });
});

const listSuppliers = endpoint(async (_req, res) => {
  const rows = await db.select().from(fournisseurs).orderBy(fournisseurs.nom);
  res.json(rows);
});

const listClientStats = endpoint(async (req, res) => {
  const id = idParam(req);
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
  if (!client) throw new ApiError(404, "Client introuvable.");
  const clientSales = await db.select().from(ventes).where(eq(ventes.idClient, id));
  const clientInvoices = await db.select().from(factures).where(eq(factures.idClient, id));
  res.json({
    totalAchats: client.totalAchats,
    soldeDu: client.soldeDu,
    nombreVentes: clientSales.length,
    nombreFactures: clientInvoices.length,
    dernierAchat: client.dernierAchat,
  });
});

export const operationsHandlers = {
  getFactures,
  getFacture,
  createFacture,
  updateFacture,
  deleteFacture,
  cleanupFactures,
  factureStats,
  factureRevenue,
  listPaiements,
  createPaiement,
  listVentes,
  getVente,
  createFactureFromVente,
  createVente,
  cancelVente,
  openCashSession,
  listCashSessions,
  closeCashSession,
  stockList,
  createStockMovement,
  listStockMovements,
  createOrder,
  listOrders,
  getOrder,
  receiveOrder,
  createReturn,
  listReturns,
  createInventory,
  listInventories,
  countInventory,
  storeSettings,
  getSettings,
  dashboard,
  report,
  listActivity,
  createStockForProduct,
  listSuppliers,
  listClientStats,
};
