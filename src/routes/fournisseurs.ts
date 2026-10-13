import { Router } from "express";

import {
    getAllFournisseurs,
    getFournisseurById,
    createFournisseur,
    updateFournisseur,
    deleteFournisseur,
} from "../services/fournisseurs";

const router = Router();


router.get("/", getAllFournisseurs);

router.get("/:id", getFournisseurById);

router.post("/", createFournisseur);

router.put("/:id", updateFournisseur);

router.delete("/:id", deleteFournisseur);


export default router;