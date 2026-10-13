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
  extensions: ["html"]
}));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});


app.use("/api/login", loginRouter);
app.use("/api", operationsRouter);


// app.use("/api", authMiddleware);

// routes protégées
app.use("/api/produits", produitsRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/utilisateurs", utilisateursRouter);
app.use("/api/fournisseurs", fournisseursRouter);
app.use("/api/auth", authRoutes);







const PORT = 9000;

app.listen(PORT, () => {
    console.log(`Serveur démarré : http://localhost:${PORT}`);
});