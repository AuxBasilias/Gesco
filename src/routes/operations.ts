import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db";
import { factures, inventaires, lignesFacture, lignesInventaire, retoursVente, ventes } from "../db/schema";
import { operationsHandlers as handlers } from "../services/operations";

const router = Router();

router.get("/dashboard", handlers.dashboard);
router.get("/rapports", handlers.report);
router.get("/administration/journal", handlers.listActivity);
router.get("/administration/parametres", handlers.getSettings);
router.put("/administration/parametres", handlers.storeSettings);

router.get("/stocks", handlers.stockList);
router.post("/produits/:id/stock", handlers.createStockForProduct);
router.get("/stocks/mouvements", handlers.listStockMovements);
router.post("/stocks/mouvements", handlers.createStockMovement);
router.get("/inventaires", handlers.listInventories);
router.post("/inventaires", handlers.createInventory);
router.post("/inventaires/:id/comptages", handlers.countInventory);
router.post("/inventaires/:id/cloture", (req, res, next) => {
  req.body = { ...req.body, cloturer: true };
  return handlers.countInventory(req, res, next);
});
router.delete("/inventaires/:id", handlers.deleteInventory);

router.get("/commandes", handlers.listOrders);
router.post("/commandes", handlers.createOrder);
router.get("/commandes/:id", handlers.getOrder);
router.post("/commandes/:id/receptions", handlers.receiveOrder);
router.get("/receptions", handlers.listReceptions);

router.get("/ventes", handlers.listVentes);
router.post("/ventes", handlers.createVente);
router.get("/ventes/:id", handlers.getVente);
router.get("/ventes/:id/serials", handlers.getVenteSerials);
router.put("/ventes/:id/serials", handlers.updateVenteSerials);
router.get("/ventes/:id/lignes-retournables", handlers.getReturnableSale);
router.post("/ventes/:id/facture", handlers.createFactureFromVente);
router.post("/ventes/:id/annulation", handlers.cancelVente);
router.get("/ventes-retours", handlers.listReturns);
router.post("/ventes-retours", handlers.createReturn);
router.post("/ventes-retours/:id/statut", handlers.setReturnStatus);

router.get("/caisse/sessions", handlers.listCashSessions);
router.post("/caisse/sessions", handlers.openCashSession);
router.post("/caisse/sessions/:id/cloture", handlers.closeCashSession);

router.get("/factures/stats", handlers.factureStats);
router.get("/factures/revenue", handlers.factureRevenue);
router.get("/factures/impayees", handlers.listUnpaidInvoices);
router.get("/factures", handlers.getFactures);
router.post("/factures", handlers.createFacture);
router.delete("/factures/cleanup", handlers.cleanupFactures);
router.get("/factures/:id/lignes", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({ success: false, message: "Identifiant invalide." });
      return;
    }
    res.json(await db.select().from(lignesFacture).where(eq(lignesFacture.idFacture, id)));
  } catch (error) {
    next(error);
  }
});
router.get("/factures/:id", handlers.getFacture);
router.put("/factures/:id", handlers.updateFacture);
router.delete("/factures/:id", handlers.deleteFacture);
router.post("/factures/:id/paiements", handlers.createPaiement);
router.post("/factures/:id/relance", handlers.remindInvoice);
router.post("/paiements/:id/annulation", handlers.cancelPaiement);
router.get("/paiements", handlers.listPaiements);

router.get("/clients/:id/stats", handlers.listClientStats);

router.get("/inventaires/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({ success: false, message: "Identifiant invalide." });
      return;
    }
    const [inventory] = await db.select().from(inventaires).where(eq(inventaires.id, id)).limit(1);
    if (!inventory) {
      res.status(404).json({ success: false, message: "Inventaire introuvable." });
      return;
    }
    res.json({
      ...inventory,
      lignes: await db.select().from(lignesInventaire).where(eq(lignesInventaire.idInventaire, id)),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/ventes-retours/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({ success: false, message: "Identifiant invalide." });
      return;
    }
    const [retour] = await db.select().from(retoursVente).where(eq(retoursVente.id, id)).limit(1);
    if (!retour) {
      res.status(404).json({ success: false, message: "Retour introuvable." });
      return;
    }
    res.json(retour);
  } catch (error) {
    next(error);
  }
});

export default router;
