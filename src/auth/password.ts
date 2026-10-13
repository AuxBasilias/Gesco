import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export async function hacherMotDePasse(
    motDePasse: string
): Promise<string> {

    return await bcrypt.hash(
        motDePasse,
        SALT_ROUNDS
    );

}

export async function verifierMotDePasse(
    motDePasse: string,
    hash: string
): Promise<boolean> {

    return await bcrypt.compare(
        motDePasse,
        hash
    );

}