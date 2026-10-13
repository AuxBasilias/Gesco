import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { db } from "../db/db";
import { clientsTable } from "../db/schema";

const champsClient = [
  "nom",
  "email",
  "type",
  "ville",
  "adresse",
  "tel",
  "nif",
  "limiteCredit",
  "delaiPaiement",
] as const;

class ClientInputError extends Error {}

function clientData(body: Record<string, unknown>, partial = false) {
  const data: Partial<typeof clientsTable.$inferInsert> = {};
  for (const field of champsClient) {
    if (partial && body[field] === undefined) continue;
    const value = body[field];
    if (field === "limiteCredit") {
      const parsed = Number(value ?? 0);
      if (!Number.isFinite(parsed) || parsed < 0) throw new ClientInputError("La limite de crédit doit être un montant positif ou nul.");
      data[field] = parsed.toFixed(2);
    } else if (field === "delaiPaiement") {
      const parsed = Number(value ?? 0);
      if (!Number.isSafeInteger(parsed) || parsed < 0) throw new ClientInputError("Le délai de paiement doit être un entier positif ou nul.");
      data[field] = parsed;
    } else if (field === "nom" || field === "type") {
      if (typeof value !== "string") {
        if (value !== undefined && value !== null) throw new ClientInputError(`Le champ ${field} doit être du texte.`);
      } else {
        data[field] = value.trim();
      }
    } else if (field === "email") {
      if (typeof value !== "string" && value !== undefined && value !== null) throw new ClientInputError("Le champ email doit être du texte.");
      data.email = typeof value === "string" ? value.trim() || null : null;
    } else if (field === "ville") {
      if (typeof value !== "string" && value !== undefined && value !== null) throw new ClientInputError("Le champ ville doit être du texte.");
      data.ville = typeof value === "string" ? value.trim() || null : null;
    } else if (field === "adresse") {
      if (typeof value !== "string" && value !== undefined && value !== null) throw new ClientInputError("Le champ adresse doit être du texte.");
      data.adresse = typeof value === "string" ? value.trim() || null : null;
    } else if (field === "tel") {
      if (typeof value !== "string" && value !== undefined && value !== null) throw new ClientInputError("Le champ téléphone doit être du texte.");
      data.tel = typeof value === "string" ? value.trim() || null : null;
    } else if (field === "nif") {
      if (typeof value !== "string" && value !== undefined && value !== null) throw new ClientInputError("Le champ NIF doit être du texte.");
      data.nif = typeof value === "string" ? value.trim() || null : null;
    }
  }
  if (!partial && (!data.nom || !data.type)) {
    throw new ClientInputError("Le nom et le type du client sont obligatoires.");
  }
  if (partial && "nom" in data && !data.nom) throw new ClientInputError("Le nom du client ne peut pas être vide.");
  if (partial && "type" in data && !data.type) throw new ClientInputError("Le type du client ne peut pas être vide.");
  return data;
}

function erreurClient(res: Response, error: unknown, operation: string) {
  if (error instanceof ClientInputError) {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error(operation, error);
  if ((error as { code?: string })?.code === "23505") {
    return res.status(409).json({ success: false, message: "Un client avec cet e-mail existe déjà." });
  }
  return res.status(500).json({ success: false, message: "Erreur lors de l'enregistrement du client." });
}

export async function getAllClients(_req: Request, res: Response) {
  try {
    res.status(200).json(await db.select().from(clientsTable));
  } catch (error) {
    console.error("Erreur récupération clients :", error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération des clients." });
  }
}

export async function getClientById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: "ID invalide." });
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
    if (!client) return res.status(404).json({ success: false, message: "Client introuvable." });
    return res.status(200).json(client);
  } catch (error) {
    console.error("Erreur récupération client :", error);
    return res.status(500).json({ success: false, message: "Erreur lors de la récupération du client." });
  }
}

export async function createClient(req: Request, res: Response) {
  try {
    const data = clientData(req.body as Record<string, unknown>);
    if (typeof data.nom !== "string" || typeof data.type !== "string") {
      throw new ClientInputError("Le nom et le type du client sont obligatoires.");
    }
    const [client] = await db.insert(clientsTable).values({
      ...data,
      nom: data.nom,
      type: data.type,
    }).returning();
    return res.status(201).json({ success: true, message: "Client créé avec succès.", client });
  } catch (error) {
    return erreurClient(res, error, "Erreur création client :");
  }
}

export async function updateClient(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: "ID invalide." });
    const data = clientData(req.body as Record<string, unknown>, true);
    if (!Object.keys(data).length) return res.status(400).json({ success: false, message: "Aucune donnée à modifier." });
    const [client] = await db.update(clientsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clientsTable.id, id))
      .returning();
    if (!client) return res.status(404).json({ success: false, message: "Client introuvable." });
    return res.status(200).json({ success: true, message: "Client modifié avec succès.", client });
  } catch (error) {
    return erreurClient(res, error, "Erreur modification client :");
  }
}

export async function deleteClient(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: "ID invalide." });
    const [deleted] = await db.delete(clientsTable).where(eq(clientsTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ success: false, message: "Client introuvable." });
    return res.status(200).json({ success: true, message: "Client supprimé avec succès." });
  } catch (error) {
    console.error("Erreur suppression client :", error);
    if ((error as { code?: string })?.code === "23503") {
      return res.status(409).json({ success: false, message: "Ce client est lié à des ventes ou factures et ne peut pas être supprimé." });
    }
    return res.status(500).json({ success: false, message: "Erreur lors de la suppression du client." });
  }
}
