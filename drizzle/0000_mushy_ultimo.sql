CREATE TYPE "public"."role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"email" text,
	"phone" text,
	"adresse" text,
	CONSTRAINT "clients_nom_unique" UNIQUE("nom"),
	CONSTRAINT "clients_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "produits" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"description" text NOT NULL,
	"image" text,
	"prix_unitaire" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utilisateurs" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom_utilisateur" text NOT NULL,
	"email" text NOT NULL,
	"mot_de_passe" text NOT NULL,
	"role" "role" NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	CONSTRAINT "utilisateurs_nom_utilisateur_unique" UNIQUE("nom_utilisateur"),
	CONSTRAINT "utilisateurs_email_unique" UNIQUE("email")
);
