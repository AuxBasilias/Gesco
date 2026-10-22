import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import loginRouter from "./routes/login"
import produitsRouter from "./routes/produits"
import clientsRouter from "./routes/clients"
import categoriesRouter from "./routes/categories"
import utilisateursRouter from "./routes/utilisateurs"
import fournisseursRouter from "./routes/fournisseurs"
import operationsRouter from "./routes/operations"


import { authMiddleware } from "./auth/auth";
import authRoutes from "./routes/auth"

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// fichiers statiques
app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  setHeaders: (res, filePath) => {
    // Les pages HTML ne doivent pas être mises en cache : l'état d'authentification
    // est vérifié à chaque visite (évite les retours arrière sur des pages périmées).
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }
}));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});


app.use("/api/login", loginRouter);
app.use("/api/utilisateurs", utilisateursRouter);



// 🔒 Toutes les routes /api suivantes exigent un token JWT valide.
// /api/login reste public (monté ci-dessus, avant ce middleware).
app.use("/api", authMiddleware);

// routes protégées
app.use("/api", operationsRouter);
app.use("/api/produits", produitsRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/fournisseurs", fournisseursRouter);
app.use("/api/auth", authRoutes);







const PORT = 9000;

app.listen(PORT, () => {
    console.log(`Serveur démarré : http://localhost:${PORT}`);
});
