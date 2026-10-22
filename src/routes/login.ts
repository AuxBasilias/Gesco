import { Router } from "express";
import { login, logout, authMiddleware } from "../auth/auth.js";

const router = Router();

/**
 * LOGIN
 */
router.post("/", async (req, res) => {
  try {
    const { email, motDePasse } = req.body;

    // Validation minimale (côté route)
    if (!email || !motDePasse) {
      return res.status(400).json({
        success: false,
        message: "Email et mot de passe requis.",
      });
    }

    // Appel couche métier
    const resultat = await login(email, motDePasse);

    return res.status(200).json(resultat);
  } catch (error: any) {
    const text = "Erreur lié a la bd";
    const errorMessage = error?.message;
    return res.status(401).json({
      success: false,
      message:
        errorMessage ||
        "Mail ou mot de passe incorrect.",
    });
  }
});

/**
 * LOGOUT
 */
router.post("/logout", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.id as number | undefined;
    const resultat = await logout(userId);

    return res.status(200).json(resultat);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la déconnexion.",
    });
  }
});

export default router;