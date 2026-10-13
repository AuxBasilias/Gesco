import { Router } from "express";
import { authMiddleware, changePassword } from "../auth/auth";



const router = Router();

// 🔒 Route protégée - l'utilisateur doit être connecté
router.post("/change-password", authMiddleware, changePassword);

export default router;