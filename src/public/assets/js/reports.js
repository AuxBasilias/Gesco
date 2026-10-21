(function () {
  "use strict";

  const api = window.AA;
  if (!api) return;

  const money = (v) => `${Number(v || 0).toLocaleString("fr-FR")} FCFA`;
  const nf = (v) => Number(v || 0).toLocaleString("fr-FR");

  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

  function buildMonthly(sales, year) {
    const map = new Array(12).fill(0);
    sales.forEach((s) => {
      if (s.statut === 'annulee') return;
      const d = new Date(s.dateVente);
      if (Number.isNaN(d.getTime())) return;
      if (d.getFullYear() !== year) return;
      map[d.getMonth()] += Number(s.montantTotal || 0);
    });
    return map.map((v, i) => ({ label: monthNames[i], value: v / 1000000 }));
  }

  function buildCategory(sales, stocks) {
    const productCat = new Map();
    stocks.forEach((p) => {
      if (p.id) productCat.set(p.id, p.idCategorie);
    });
    const catName = new Map();
    stocks.forEach((p) => {
      if (p.idCategorie && !catName.has(p.idCategorie)) catName.set(p.idCategorie, p.categorieNom || p.nomCategorie || `Cat ${p.idCategorie}`);
    });
    const sum = new Map();
    sales.forEach((s) => {
      if (s.statut === 'annulee') return;
      (s.lignes || []).forEach((l) => {
        const pid = l.idProduit;
        if (!pid) return;
        const c = productCat.get(pid);
        if (!c) return;
        sum.set(c, (sum.get(c) || 0) + Number(l.montantTotal || 0));
      });
    });
    const total = Array.from(sum.values()).reduce((a,b)=>a+b,0) || 1;
    return Array.from(sum.entries()).map(([id, amt]) => ({ id, name: catName.get(id) || `Cat ${id}`, pct: Math.round((amt/total)*100), amt }));
  }

  async function hydrate() {
    const main = document.querySelector("main");
    if (!main) return;
    const [sales, stocks, factures, clients] = await Promise.all([
      api.getVentes(),
      api.getStocks(),
      api.getFactures(),
      api.getClients(),
    ]);

    const salesList = Array.isArray(sales) ? sales : (Array.isArray(sales?.data) ? sales.data : []);
    const stocksList = Array.isArray(stocks) ? stocks : (Array.isArray(stocks?.data) ? stocks.data : []);
    const facturesList = Array.isArray(factures) ? factures : (Array.isArray(factures?.data) ? factures.data : []);
    const clientsList = Array.isArray(clients) ? clients : (Array.isArray(clients?.data) ? clients.data : []);

    const year = new Date().getFullYear();
    const monthStart = new Date(year, new Date().getMonth(), 1);
    const salesMonth = salesList.filter((s) => {
      if (s.statut === 'annulee') return false;
      const d = new Date(s.dateVente);
      return !Number.isNaN(d.getTime()) && d >= monthStart;
    });
    const caMonth = salesMonth.reduce((a,s)=>a+Number(s.montantTotal||0),0);
    const impayes = facturesList.filter((f) => {
      const solde = Number(f.solde ?? (Number(f.montantTotal||0)-Number(f.montantPaye||0)));
      return solde > 0;
    });
    const sumImpayes = impayes.reduce((a,f)=>a + Number(f.solde ?? (Number(f.montantTotal||0)-Number(f.montantPaye||0))), 0);

    const cards = main.querySelectorAll(".row.g-3.mb-4 .card-body h3");
    if (cards[0]) cards[0].textContent = nf(facturesList.length);
    if (cards[1]) cards[1].textContent = (caMonth/1000000).toLocaleString("fr-FR",{minimumFractionDigits:1,maximumFractionDigits:1}) + "M";
    if (cards[2]) cards[2].textContent = nf(salesMonth.length);
    if (cards[3]) cards[3].textContent = money(Math.round(sumImpayes));

    if (window.Chart) {
      const ca = document.getElementById('rapportCA');
      if (ca) {
        const m = buildMonthly(salesList, year);
        new Chart(ca.getContext('2d'), {
          type: 'bar',
          data: { labels: m.map(x=>x.label), datasets: [{ label: `CA ${year}`, data: m.map(x=>x.value), backgroundColor: 'rgba(1,54,136,0.8)', borderRadius: 4 }] },
          options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y.toFixed(2) + 'M FCFA' } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => v + 'M' } } } }
        });
      }
      const cat = document.getElementById('rapportCat');
      if (cat) {
        const c = buildCategory(salesList, stocksList).sort((a,b)=>b.pct-a.pct).slice(0,5);
        const colors = ['#013688','#c10108','#4d81c9','#979a9e','#1c1e24'];
        new Chart(cat.getContext('2d'), {
          type: 'doughnut',
          data: { labels: c.map(x=>x.name), datasets: [{ data: c.map(x=>x.pct), backgroundColor: colors, borderWidth: 0 }] },
          options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: false } } }
        });
        const ul = main.querySelector('.list-unstyled.small.mt-3.mb-0');
        if (ul) {
          ul.innerHTML = '';
          c.forEach((x,i)=>{
            const li = document.createElement('li');
            li.className = 'd-flex justify-content-between';
            li.innerHTML = `<span><span class="d-inline-block rounded-circle me-2" style="width:9px;height:9px;background:${colors[i%colors.length]}"></span>${x.name}</span><span class="fw-medium">${x.pct}%</span>`;
            ul.append(li);
          });
        }
      }
    }

    const prod = new Map();
    salesList.forEach((s)=>{
      if (s.statut === 'annulee') return;
      (s.lignes||[]).forEach((l)=>{
        const k = l.designation || l.idProduit;
        const cur = prod.get(k)||{qty:0,ca:0};
        cur.qty += Number(l.quantite||0);
        cur.ca += Number(l.montantTotal||0);
        prod.set(k,cur);
      });
    });
    const topP = Array.from(prod.entries()).sort((a,b)=>b[1].ca-a[1].ca).slice(0,5);
    const tbP = main.querySelectorAll('.table.adminuiux-table tbody')[0];
    if (tbP) {
      tbP.innerHTML = topP.length ? topP.map(([n,v])=>`<tr><td class="small">${n}</td><td class="text-center">${nf(v.qty)}</td><td class="text-end fw-medium">${money(v.ca)}</td><td class="text-end">—</td></tr>`).join('') : '<tr><td colspan="4" class="text-center text-secondary">Aucune donnée</td></tr>';
    }

    const cli = new Map();
    salesList.forEach((s)=>{
      if (s.statut === 'annulee') return;
      const k = s.idClient || 'comptoir';
      cli.set(k, (cli.get(k)||0)+Number(s.montantTotal||0));
    });
    const topC = Array.from(cli.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const tbC = main.querySelectorAll('.table.adminuiux-table tbody')[1];
    if (tbC) {
      const rows = topC.map(([id,total])=>{
        const c = clientsList.find(x=>String(x.id)===String(id));
        const name = c?.nom || (id==='comptoir'?'Client comptoir':`Client ${id}`);
        const achats = salesList.filter(s=>!s.statut||s.statut!=='annulee' ? String(s.idClient)===String(id):false).length;
        const f = facturesList.filter(fa=>String(fa.idClient)===String(id));
        const solde = f.reduce((a,fa)=>a + Math.max(0, Number(fa.solde ?? (Number(fa.montantTotal||0)-Number(fa.montantPaye||0)))), 0);
        return `<tr><td class="small">${name}</td><td class="text-center">${achats}</td><td class="text-end fw-medium">${money(total)}</td><td class="text-end ${solde>0?'text-danger':''}">${solde>0?money(solde):'—'}</td></tr>`;
      });
      tbC.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="4" class="text-center text-secondary">Aucune donnée</td></tr>';
    }
  }

  document.addEventListener('DOMContentLoaded', hydrate);
})();
