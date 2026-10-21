(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const api = window.AA;
    if (!api) return;
    const money = (v) => `${Number(v || 0).toLocaleString("fr-FR")} FCFA`;
    const num = (v) => Number(v || 0).toLocaleString("fr-FR");
    const tbody = document.getElementById("fournisseurs-tbody");
    const fStat = document.querySelector('[data-stat="fournisseurs"]');
    const cStat = document.querySelector('[data-stat="commandes"]');
    const aStat = document.querySelector('[data-stat="achats"]');
    const pag = document.getElementById("fournisseurs-pagination");

    function list(v) { return Array.isArray(v) ? v : Array.isArray(v && v.data) ? v.data : []; }

    async function load() {
      try {
        const [fournisseurs, commandes] = await Promise.all([api.getFournisseurs(), api.getCommandes()]);
        const f = list(fournisseurs);
        const c = list(commandes);
        if (fStat) fStat.textContent = num(f.length);
        if (cStat) cStat.textContent = num(c.length);
        const totalAchats = c.reduce((s, row) => s + Number(row.montantTotal || 0), 0);
        if (aStat) aStat.textContent = totalAchats >= 1000000 ? `${(totalAchats / 1000000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}M` : money(totalAchats);
        if (!tbody) return;
        tbody.innerHTML = "";
        if (f.length === 0) {
          const tr = document.createElement("tr");
          const td = document.createElement("td");
          td.colSpan = 6;
          td.className = "text-center text-secondary py-4";
          td.textContent = "Aucun fournisseur enregistré.";
          tr.append(td);
          tbody.append(tr);
          if (pag) pag.textContent = "Affichage de 0 fournisseur";
          return;
        }
        const cmdByF = {};
        c.forEach((row) => {
          const id = row.idFournisseur;
          if (!cmdByF[id]) cmdByF[id] = { count: 0, total: 0 };
          cmdByF[id].count += 1;
          cmdByF[id].total += Number(row.montantTotal || 0);
        });
        f.forEach((sup) => {
          const agg = cmdByF[sup.id] || { count: 0, total: 0 };
          const tr = document.createElement("tr");
          const tdNom = document.createElement("td");
          const link = document.createElement("a");
          link.href = `gesco-approvisionnement-fournisseur-detail.html?id=${encodeURIComponent(sup.id)}`;
          link.className = "fw-medium";
          link.textContent = sup.nom || "—";
          tdNom.append(link);
          const tdTel = document.createElement("td");
          tdTel.className = "small";
          tdTel.textContent = sup.tel || "—";
          const tdEmail = document.createElement("td");
          tdEmail.className = "small";
          tdEmail.textContent = sup.email || "—";
          const tdAdr = document.createElement("td");
          tdAdr.className = "small";
          tdAdr.textContent = sup.adresse || "—";
          const tdNif = document.createElement("td");
          tdNif.className = "small";
          tdNif.textContent = sup.nif || "—";
          const tdActions = document.createElement("td");
          tdActions.className = "text-end";
          const detail = document.createElement("a");
          detail.href = `gesco-approvisionnement-fournisseur-detail.html?id=${encodeURIComponent(sup.id)}`;
          detail.className = "btn btn-sm btn-square btn-link";
          detail.title = "Consulter";
          detail.innerHTML = '<i class="bi bi-eye"></i>';
          const edit = document.createElement("button");
          edit.type = "button";
          edit.className = "btn btn-sm btn-square btn-link";
          edit.title = "Modifier";
          edit.innerHTML = '<i class="bi bi-pencil"></i>';
          const del = document.createElement("button");
          del.type = "button";
          del.className = "btn btn-sm btn-square btn-link text-danger";
          del.title = "Supprimer";
          del.innerHTML = '<i class="bi bi-trash"></i>';
          del.addEventListener("click", async () => {
            if (!confirm("Voulez-vous vraiment supprimer ce fournisseur ?")) return;
            try {
              if (typeof api.deleteFournisseur === "function") {
                await api.deleteFournisseur(sup.id);
                load();
              }
            } catch (err) {
              console.error(err);
              alert("Impossible de supprimer ce fournisseur.");
            }
          });
          tdActions.append(detail, edit, del);
          tr.append(tdNom, tdTel, tdEmail, tdAdr, tdNif, tdActions);
          tbody.append(tr);
        });
        if (pag) pag.textContent = `Affichage de 1 à ${f.length} sur ${f.length} fournisseur${f.length > 1 ? "s" : ""}`;
      } catch (e) {
        console.error("Chargement fournisseurs :", e);
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Erreur lors du chargement des fournisseurs.</td></tr>';
        }
      }
    }
    load();
  });
})();
