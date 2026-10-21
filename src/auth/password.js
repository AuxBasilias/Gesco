import bcrypt from "bcrypt";
const SALT_ROUNDS = 12;
export async function hacherMotDePasse(motDePasse) {
    return await bcrypt.hash(motDePasse, SALT_ROUNDS);
}
export async function verifierMotDePasse(motDePasse, hash) {
    return await bcrypt.compare(motDePasse, hash);
}
