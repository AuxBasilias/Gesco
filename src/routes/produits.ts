import { Router } from "express";

import {
    getAllProduits,
    getProduitById,
    createProduit,
    updateProduit,
    deleteProduit,
} from "../services/produits.js";

const router = Router();


router.get("/", getAllProduits);

router.get("/:id", getProduitById);

router.post("/", createProduit);

router.put("/:id", updateProduit);

router.delete("/:id", deleteProduit);


export default router;