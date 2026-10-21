import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/db";
import { commandesFournisseurs, factures, journalActivite, inventaires, lignesCommande, lignesFacture, lignesInventaire, lignesReception, lignesVente, mouvementsStock, operationsCaisse, paiements, produits, receptions, sessionsCaisse, stocks, fournisseurs, ventes, } from "../db/schema";
const baseUrl = process.env.TEST_BASE_URL;
if (process.env.RUN_MUTATING_INTEGRATION_TESTS !== "1") {
    throw new Error("Définissez RUN_MUTATING_INTEGRATION_TESTS=1 pour autoriser les tests métier avec écritures.");
}
if (!baseUrl)
    throw new Error("TEST_BASE_URL est obligatoire.");
const parsedBaseUrl = new URL(baseUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(parsedBaseUrl.hostname)) {
    throw new Error("Les tests métier ne peuvent cibler qu'un serveur local.");
}
if (process.env.ALLOW_SHARED_DATABASE_INTEGRATION !== "1") {
    throw new Error("Définissez ALLOW_SHARED_DATABASE_INTEGRATION=1 après avoir vérifié la base cible.");
}
async function api(path, init) {
    const response = await fetch(new URL(path, baseUrl), {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const data = await response.json();
    return { status: response.status, data: data?.data ?? data };
}
function checkStatus(status, expected, message) {
    assert.equal(status, expected, `${message} (HTTP ${status}, attendu ${expected})`);
}
async function removeTestSale(sale) {
    if (!sale?.id)
        return;
    await db.transaction(async (tx) => {
        const linkedInvoices = await tx.select({ id: factures.id }).from(factures)
            .where(eq(factures.idVente, sale.id));
        const invoiceIds = linkedInvoices.map((invoice) => invoice.id);
        if (invoiceIds.length) {
            await tx.delete(journalActivite).where(and(eq(journalActivite.action, "facture.creee_depuis_vente"), inArray(sql `(${journalActivite.details}->>'id')::integer`, invoiceIds)));
            await tx.delete(paiements).where(inArray(paiements.idFacture, invoiceIds));
            await tx.delete(lignesFacture).where(inArray(lignesFacture.idFacture, invoiceIds));
            await tx.delete(factures).where(inArray(factures.id, invoiceIds));
        }
        await tx.delete(journalActivite).where(and(inArray(journalActivite.action, ["vente.creee", "vente.annulee", "facture.creee_depuis_vente"]), sql `${journalActivite.details}->>'id' = ${String(sale.id)}`));
        await tx.delete(mouvementsStock).where(and(eq(mouvementsStock.reference, sale.reference), inArray(mouvementsStock.type, ["vente", "annulation_vente"])));
        await tx.delete(operationsCaisse).where(eq(operationsCaisse.idVente, sale.id));
        await tx.delete(lignesVente).where(eq(lignesVente.idVente, sale.id));
        await tx.delete(ventes).where(eq(ventes.id, sale.id));
    });
}
async function removeTestOrder(order, originalStock) {
    if (!order?.id)
        return;
    await db.transaction(async (tx) => {
        const receipts = await tx.select().from(receptions).where(eq(receptions.idCommande, order.id));
        const receiptIds = receipts.map((receipt) => receipt.id);
        const receiptReferences = receipts.map((receipt) => receipt.reference);
        if (receiptIds.length) {
            await tx.delete(lignesReception).where(inArray(lignesReception.idReception, receiptIds));
            await tx.delete(receptions).where(inArray(receptions.id, receiptIds));
        }
        if (receiptReferences.length) {
            await tx.delete(mouvementsStock).where(and(eq(mouvementsStock.type, "reception"), inArray(mouvementsStock.reference, receiptReferences)));
        }
        await tx.delete(journalActivite).where(and(eq(journalActivite.action, "approvisionnement.commande_creee"), sql `${journalActivite.details}->>'id' = ${String(order.id)}`));
        await tx.delete(journalActivite).where(and(eq(journalActivite.action, "approvisionnement.reception"), sql `${journalActivite.details}->>'idCommande' = ${String(order.id)}`));
        await tx.update(stocks).set({
            quantite: originalStock.quantite,
            idFournisseur: originalStock.idFournisseur,
            updatedAt: originalStock.updatedAt,
        })
            .where(eq(stocks.idProduit, order.testProductId));
        await tx.delete(lignesCommande).where(eq(lignesCommande.idCommande, order.id));
        await tx.delete(commandesFournisseurs).where(eq(commandesFournisseurs.id, order.id));
    });
}
async function removeTestInventory(inventory, productId, originalStock) {
    if (!inventory?.id)
        return;
    await db.transaction(async (tx) => {
        await tx.delete(mouvementsStock).where(and(eq(mouvementsStock.type, "inventaire"), eq(mouvementsStock.reference, inventory.reference)));
        await tx.delete(journalActivite).where(and(inArray(journalActivite.action, ["stock.inventaire_cree", "stock.inventaire_compte"]), sql `(${journalActivite.details}->>'id' = ${String(inventory.id)} OR ${journalActivite.details}->>'idInventaire' = ${String(inventory.id)})`));
        await tx.delete(lignesInventaire).where(eq(lignesInventaire.idInventaire, inventory.id));
        await tx.delete(inventaires).where(eq(inventaires.id, inventory.id));
        await tx.update(stocks).set({ quantite: originalStock, updatedAt: new Date() })
            .where(eq(stocks.idProduit, productId));
    });
}
async function main() {
    const [supplierRows, productRows, sessionRows] = await Promise.all([
        db.select().from(fournisseurs).limit(1),
        db.select().from(produits).innerJoin(stocks, eq(produits.id, stocks.idProduit)),
        db.select().from(sessionsCaisse).where(eq(sessionsCaisse.statut, "ouverte")).limit(1),
    ]);
    const supplier = supplierRows[0];
    const product = productRows.find(({ stocks: stock }) => stock.quantite >= 1);
    const session = sessionRows[0];
    assert.ok(supplier, "Le test nécessite un fournisseur existant.");
    assert.ok(product, "Le test nécessite un produit avec au moins une unité en stock.");
    assert.ok(session, "Le test de vente nécessite une session de caisse ouverte.");
    const originalStock = product.stocks.quantite;
    const originalStockRow = product.stocks;
    const originalExpectedCash = Number(session.montantAttendu);
    const testRunId = randomUUID();
    const orderReference = `TST-CMD-${testRunId}`;
    const saleReference = `TST-VTE-${testRunId}`;
    let order;
    let sale;
    let inventory;
    const failures = [];
    try {
        const inventoryResponse = await api("/api/inventaires", {
            method: "POST",
            body: JSON.stringify({
                reference: `Inventaire test ${testRunId.slice(0, 8)}`,
                notes: `Inventaire de test ${testRunId}`,
                responsable: "Responsable de test",
            }),
        });
        checkStatus(inventoryResponse.status, 201, "Création d'un inventaire");
        const inv = inventoryResponse.data;
        inventory = inv;
        assert.ok(inv?.id, "L'inventaire créé doit avoir un identifiant.");
        assert.equal(inv.reference, `Inventaire test ${testRunId.slice(0, 8)}`);
        assert.equal(inv.statut, "en_cours");
        assert.equal(inv.responsable, "Responsable de test", "Le responsable saisi doit être enregistré.");
        const inventoryDetail = await api(`/api/inventaires/${inv.id}`);
        checkStatus(inventoryDetail.status, 200, "Lecture de l'inventaire");
        const lines = inventoryDetail.data.lignes;
        assert.ok(lines.length >= 1, "L'inventaire doit contenir les lignes de stock.");
        const targetLine = lines.find((line) => line.idProduit === product.produits.id);
        assert.ok(targetLine, "Le produit de test doit figurer dans l'inventaire.");
        const counted = lines.map((line) => ({
            idProduit: line.idProduit,
            quantiteComptee: line.idProduit === product.produits.id
                ? Number(line.quantiteTheorique) + 1
                : Number(line.quantiteTheorique),
        }));
        const countResponse = await api(`/api/inventaires/${inv.id}/comptages`, {
            method: "POST",
            body: JSON.stringify({ lignes: counted }),
        });
        checkStatus(countResponse.status, 200, "Enregistrement du comptage");
        const afterCount = await api(`/api/inventaires/${inv.id}`);
        const countedLine = afterCount.data.lignes.find((line) => line.idProduit === product.produits.id);
        assert.equal(Number(countedLine?.ecart), 1, "L'écart du produit compté doit être de +1.");
        const listAfterCount = await api("/api/inventaires");
        const listed = listAfterCount.data.find((item) => item.id === inv.id);
        assert.equal(Number(listed?.articlesComptes), lines.length, "Toutes les lignes doivent être comptées.");
        assert.equal(Number(listed?.ecarts), 1, "Un seul article présente un écart.");
        assert.equal(listed?.responsable, "Responsable de test", "La liste doit exposer le responsable enregistré.");
        const closeResponse = await api(`/api/inventaires/${inv.id}/cloture`, {
            method: "POST",
            body: JSON.stringify({ lignes: counted }),
        });
        checkStatus(closeResponse.status, 200, "Clôture de l'inventaire");
        const [closedInventory] = await db.select().from(inventaires).where(eq(inventaires.id, inv.id));
        assert.equal(closedInventory.statut, "termine");
        const currentStock = await api(`/api/produits/${product.produits.id}`);
        assert.equal(Number(currentStock.data.stock), originalStock + 1, "Le stock doit refléter l'écart d'inventaire.");
        const adjustmentMovement = await db.select().from(mouvementsStock).where(and(eq(mouvementsStock.type, "inventaire"), eq(mouvementsStock.reference, inv.reference)));
        assert.equal(adjustmentMovement.length, 1, "Un mouvement d'ajustement doit être journalisé.");
        assert.equal(adjustmentMovement[0].quantite, 1);
        console.log("PASS: création, comptage, clôture d'inventaire et ajustement de stock");
        const deleteResponse = await api(`/api/inventaires/${inv.id}`, { method: "DELETE" });
        checkStatus(deleteResponse.status, 200, "Suppression de l'inventaire");
        const remainingInventory = await db.select().from(inventaires).where(eq(inventaires.id, inv.id));
        assert.equal(remainingInventory.length, 0, "L'inventaire supprimé ne doit plus exister.");
        const remainingMovements = await db.select().from(mouvementsStock).where(and(eq(mouvementsStock.type, "inventaire"), eq(mouvementsStock.reference, inv.reference)));
        assert.equal(remainingMovements.length, 0, "Les mouvements liés doivent être supprimés.");
        inventory = undefined;
        const [restoredStock] = await db.select().from(stocks).where(eq(stocks.idProduit, product.produits.id));
        assert.equal(restoredStock.quantite, originalStock, "Le stock doit être restauré après suppression de l'inventaire.");
        console.log("PASS: suppression d'inventaire et annulation de l'ajustement de stock");
        const orderResponse = await api("/api/commandes", {
            method: "POST",
            body: JSON.stringify({
                reference: orderReference,
                idFournisseur: supplier.id,
                lignes: [{
                        idProduit: product.produits.id,
                        quantite: 2,
                        prixUnitaire: Number(product.produits.prixAchat),
                    }],
            }),
        });
        checkStatus(orderResponse.status, 201, "Création de commande fournisseur");
        order = { ...orderResponse.data, testProductId: product.produits.id };
        assert.equal(Number(order.montantTotal), Number(product.produits.prixAchat) * 2);
        const detailResponse = await api(`/api/commandes/${order.id}`);
        checkStatus(detailResponse.status, 200, "Lecture du bon de commande");
        assert.equal(detailResponse.data.lignes.length, 1);
        assert.equal(detailResponse.data.fournisseur.id, supplier.id);
        const orderLines = await db.select().from(lignesCommande).where(eq(lignesCommande.idCommande, order.id));
        assert.equal(orderLines.length, 1);
        const line = orderLines[0];
        const firstReceipt = await api(`/api/commandes/${order.id}/receptions`, {
            method: "POST",
            body: JSON.stringify({ lignes: [{ idLigneCommande: line.id, quantiteRecue: 1 }] }),
        });
        checkStatus(firstReceipt.status, 201, "Réception partielle");
        let orderState = await api(`/api/commandes/${order.id}`);
        assert.equal(orderState.data.statut, "partielle");
        let currentProduct = await api(`/api/produits/${product.produits.id}`);
        assert.equal(Number(currentProduct.data.stock), originalStock + 1);
        const secondReceipt = await api(`/api/commandes/${order.id}/receptions`, {
            method: "POST",
            body: JSON.stringify({ lignes: [{ idLigneCommande: line.id, quantiteRecue: 1 }] }),
        });
        checkStatus(secondReceipt.status, 201, "Réception finale");
        orderState = await api(`/api/commandes/${order.id}`);
        assert.equal(orderState.data.statut, "recue");
        currentProduct = await api(`/api/produits/${product.produits.id}`);
        assert.equal(Number(currentProduct.data.stock), originalStock + 2);
        const excessReceipt = await api(`/api/commandes/${order.id}/receptions`, {
            method: "POST",
            body: JSON.stringify({ lignes: [{ idLigneCommande: line.id, quantiteRecue: 1 }] }),
        });
        checkStatus(excessReceipt.status, 400, "Refus d'une réception excédentaire");
        const checkoutResponse = await api("/api/ventes", {
            method: "POST",
            body: JSON.stringify({
                reference: saleReference,
                idSessionCaisse: session.id,
                tauxTaxe: 0,
                modePaiement: "especes",
                montantPaye: Number(product.produits.prixVente),
                montantRecu: Number(product.produits.prixVente),
                lignes: [{
                        idProduit: product.produits.id,
                        quantite: 1,
                        prixUnitaire: Number(product.produits.prixVente),
                    }],
            }),
        });
        checkStatus(checkoutResponse.status, 201, "Encaissement comptoir");
        sale = checkoutResponse.data;
        assert.equal(Number(sale.montantTotal), Number(product.produits.prixVente));
        currentProduct = await api(`/api/produits/${product.produits.id}`);
        assert.equal(Number(currentProduct.data.stock), originalStock + 1);
        const invoiceResponse = await api(`/api/ventes/${sale.id}/facture`, { method: "POST" });
        checkStatus(invoiceResponse.status, 201, "Création de facture depuis la vente");
        assert.equal(invoiceResponse.data.idVente, sale.id);
        assert.equal(invoiceResponse.data.lignes.length, 1);
        assert.equal(Number(invoiceResponse.data.montantTotal), Number(sale.montantTotal));
        const repeatInvoice = await api(`/api/ventes/${sale.id}/facture`, { method: "POST" });
        checkStatus(repeatInvoice.status, 200, "Récupération idempotente de la facture");
        assert.equal(repeatInvoice.data.id, invoiceResponse.data.id);
        const cancelResponse = await api(`/api/ventes/${sale.id}/annulation`, { method: "POST" });
        checkStatus(cancelResponse.status, 200, "Annulation de la vente");
        const [cancelledSale] = await db.select().from(ventes).where(eq(ventes.id, sale.id));
        const [cancelledInvoice] = await db.select().from(factures).where(eq(factures.id, invoiceResponse.data.id));
        assert.equal(cancelledSale.statut, "annulee");
        assert.equal(cancelledInvoice.statut, "annulee");
        currentProduct = await api(`/api/produits/${product.produits.id}`);
        assert.equal(Number(currentProduct.data.stock), originalStock + 2);
        console.log("PASS: création, consultation, réception partielle/finale et contrôle de dépassement fournisseur");
        console.log("PASS: encaissement, facture liée/idempotente et annulation synchronisée");
    }
    catch (error) {
        failures.push(error instanceof Error ? error : new Error(String(error)));
    }
    finally {
        try {
            if (!sale) {
                const [persistedSale] = await db.select().from(ventes).where(eq(ventes.reference, saleReference));
                if (persistedSale)
                    sale = persistedSale;
            }
            if (sale?.id) {
                const currentSale = await api(`/api/ventes/${sale.id}`);
                if (currentSale.status === 200 && currentSale.data.statut !== "annulee") {
                    const cancellation = await api(`/api/ventes/${sale.id}/annulation`, { method: "POST" });
                    checkStatus(cancellation.status, 200, "Annulation compensatoire du test");
                }
            }
            if (!order) {
                const [persistedOrder] = await db.select().from(commandesFournisseurs)
                    .where(eq(commandesFournisseurs.reference, orderReference));
                if (persistedOrder) {
                    order = { ...persistedOrder, testProductId: product.produits.id };
                }
            }
            if (!inventory) {
                const [persistedInventory] = await db.select().from(inventaires)
                    .where(eq(inventaires.notes, `Inventaire de test ${testRunId}`));
                if (persistedInventory)
                    inventory = persistedInventory;
            }
            await removeTestInventory(inventory, product.produits.id, originalStock);
            await removeTestSale(sale);
            await removeTestOrder(order, originalStockRow);
            const [restoredSession] = await db.select().from(sessionsCaisse).where(eq(sessionsCaisse.id, session.id));
            assert.equal(Number(restoredSession.montantAttendu), originalExpectedCash, "La caisse doit retrouver son montant attendu initial.");
            const [restoredStock] = await db.select().from(stocks).where(eq(stocks.idProduit, product.produits.id));
            assert.equal(restoredStock.quantite, originalStock, "Le stock du produit doit retrouver sa quantité initiale.");
            console.log("PASS: nettoyage du jeu d'essai et restauration du stock/de la caisse");
        }
        catch (error) {
            failures.push(new Error(`Échec du nettoyage : ${error instanceof Error ? error.message : String(error)}`));
        }
    }
    if (failures.length)
        throw new AggregateError(failures, "Échec des tests d'intégration métier.");
}
main().finally(async () => {
    await db.$client.end({ timeout: 5 });
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
