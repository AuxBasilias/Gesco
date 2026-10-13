import { Router } from "express";

import {
    getAllCategories,
    getCategorieById,
    createCategorie,
    updateCategorie,
    deleteCategorie,
} from "../services/categories";

const router = Router();


router.get("/", getAllCategories);

router.get("/:id", getCategorieById);

router.post("/", createCategorie);

router.put("/:id", updateCategorie);

router.delete("/:id", deleteCategorie);


export default router;