import { hacherMotDePasse } from '../auth/password.js';
import { db } from '../db/db.js';
import { utilisateursTable } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';

type UtilisateurPublic = Omit<typeof utilisateursTable.$inferSelect, 'motDePasse'>;

function sansMotDePasse(utilisateur: typeof utilisateursTable.$inferSelect): UtilisateurPublic {
  const { motDePasse: _motDePasse, ...publicUtilisateur } = utilisateur;
  return publicUtilisateur;
}

export async function createUtilisateur(
    utilisateur: typeof utilisateursTable.$inferInsert
) {

    try {

        const hash = await hacherMotDePasse(
            utilisateur.motDePasse
        );

        const [created] = await db.insert(utilisateursTable).values({
            ...utilisateur,
            motDePasse: hash,
        }).returning();

        console.log("✅ Nouvel utilisateur !");
        return created ? sansMotDePasse(created) : undefined;

    } catch (error) {

        console.error(error);
        throw error;

    }

}


export async function getAllUtilisateurs() {
  try {
    const utilisateurs = await db.select().from(utilisateursTable).orderBy(desc(utilisateursTable.createdAt), desc(utilisateursTable.id));
    console.log('✅ Retrieved all utilisateurs');
    return utilisateurs.map(sansMotDePasse);
  } catch (error) {
    console.error('❌ Error fetching utilisateurs:', error);
    throw error;
  }
}


export async function getUtilisateurById(id: number) {
  try {
    const utilisateur = await db
      .select()
      .from(utilisateursTable)
      .where(eq(utilisateursTable.id, id));
    
    if (utilisateur.length === 0) {
      console.log('⚠️ Utilisateur not found');
      return null;
    }
    
    console.log('✅ Retrieved utilisateur by ID');
    return sansMotDePasse(utilisateur[0]);
  } catch (error) {
    console.error('❌ Error fetching utilisateur:', error);
    throw error;
  }
}

export async function getUtilisateurByName(nom: string) {
  try {
    const utilisateur = await db
      .select()
      .from(utilisateursTable)
      .where(eq(utilisateursTable.nomUtilisateur, nom));
    
    if (utilisateur.length === 0) {
      console.log('⚠️ Utilisateur not found');
      return null;
    }
    
    console.log('✅ Retrieved utilisateur by Name');
    return sansMotDePasse(utilisateur[0]);
  } catch (error) {
    console.error('❌ Error fetching utilisateur:', error);
    throw error;
  }
}

export async function getUtilisateurByEmail(email: string) {
  try {
    const utilisateur = await db
      .select()
      .from(utilisateursTable)
      .where(eq(utilisateursTable.email, email));
    
    if (utilisateur.length === 0) {
      console.log('⚠️ Utilisateur not found');
      return null;
    }
    
    console.log('✅ Retrieved utilisateur by Name');
    return utilisateur[0];
  } catch (error) {
    console.error('❌ Error fetching utilisateur:', error);
    throw error;
  }
}



export async function updateUtilisateur(
    id: number,
    updates: Partial<typeof utilisateursTable.$inferInsert>
) {

    try {

        const donnees = { ...updates, updatedAt: new Date() };

        if (donnees.motDePasse) {

            donnees.motDePasse =
                await hacherMotDePasse(
                    donnees.motDePasse
                );

        }

        await db
            .update(utilisateursTable)
            .set(donnees)
            .where(eq(utilisateursTable.id, id));
          
          // Récupérer et retourner l'utilisateur modifié
        const utilisateur = await db
            .select()
            .from(utilisateursTable)
            .where(eq(utilisateursTable.id, id))
            .limit(1);

        console.log("✅ Utilisateur modifié");
        
        return utilisateur[0] ? sansMotDePasse(utilisateur[0]) : null;

;


    } catch (error) {

        console.error(error);
        throw error;

    }

}


export async function deleteUtilisateur(id: number) {
  try {
    await db.delete(utilisateursTable).where(eq(utilisateursTable.id, id));
    console.log('✅ Utilisateur deleted!');
    return { success: true, message: 'Utilisateur deleted successfully' };
  } catch (error) {
    console.error('❌ Error deleting utilisateur:', error);
    throw error;
  }
}
