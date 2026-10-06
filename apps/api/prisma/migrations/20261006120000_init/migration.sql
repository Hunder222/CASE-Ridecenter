-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rolle" AS ENUM ('Ledelse', 'Ridelaerer', 'Vikar', 'Staldelev');

-- CreateEnum
CREATE TYPE "Temperament" AS ENUM ('Rolig', 'Normal', 'Frisk');

-- CreateEnum
CREATE TYPE "Sundhedsstatus" AS ENUM ('Aktiv', 'Sygemeldt', 'Skadet', 'Karantaene');

-- CreateEnum
CREATE TYPE "Erfaringsniveau" AS ENUM ('Begynder', 'Letoevet', 'Oevet');

-- CreateEnum
CREATE TYPE "AktivStatus" AS ENUM ('Aktiv', 'Pauseret', 'Opsagt');

-- CreateEnum
CREATE TYPE "Niveau" AS ENUM ('Traekhold', 'Begynder', 'Letoevet', 'Oevet', 'Parthold');

-- CreateEnum
CREATE TYPE "KoerselStatus" AS ENUM ('Kladde', 'Afvist', 'Godkendt', 'Publiceret', 'Forkastet');

-- CreateEnum
CREATE TYPE "LektionStatus" AS ENUM ('Planlagt', 'Afviklet', 'Aflyst');

-- CreateEnum
CREATE TYPE "PladsKilde" AS ENUM ('Plan', 'Venteliste', 'Hjaelper');

-- CreateEnum
CREATE TYPE "NotifikationType" AS ENUM ('VIKAR_LOGIN', 'GENTAGET_FRAVAER', 'SYNK_KONFLIKT', 'KAPACITETSMANGEL', 'HEST_UDE_AF_DRIFT', 'GENBESAETTELSESFORSLAG', 'PARTAFTALE_MANGLER_NIVEAUGODKENDELSE');

-- CreateTable
CREATE TABLE "bruger" (
    "id" UUID NOT NULL,
    "navn" TEXT NOT NULL,
    "roller" "Rolle"[],
    "pin_hash" TEXT,
    "email" TEXT,
    "password_hash" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bruger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hest" (
    "id" UUID NOT NULL,
    "navn" TEXT NOT NULL,
    "stangmaal_cm" INTEGER NOT NULL,
    "max_rytter_vaegt_kg" INTEGER NOT NULL,
    "max_rytter_hoejde_cm" INTEGER,
    "temperament" "Temperament" NOT NULL,
    "godkendt_til_begyndere" BOOLEAN NOT NULL DEFAULT false,
    "egnet_oevet" BOOLEAN NOT NULL DEFAULT true,
    "skaane" BOOLEAN NOT NULL DEFAULT false,
    "max_lektioner_dag" INTEGER NOT NULL,
    "springforbud" BOOLEAN NOT NULL DEFAULT false,
    "max_spring_uge" INTEGER NOT NULL,
    "hviledag" INTEGER NOT NULL,
    "sundhedsstatus" "Sundhedsstatus" NOT NULL DEFAULT 'Aktiv',
    "staldnoter" TEXT NOT NULL DEFAULT '',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "hest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rytter" (
    "id" UUID NOT NULL,
    "fornavn" TEXT NOT NULL,
    "efternavn" TEXT NOT NULL,
    "foedselsdato" DATE NOT NULL,
    "bopaelskommune" TEXT NOT NULL,
    "hoejde_cm" INTEGER NOT NULL,
    "vaegt_kg" INTEGER NOT NULL,
    "erfaringsniveau" "Erfaringsniveau" NOT NULL,
    "klar_til_udvikling" BOOLEAN NOT NULL DEFAULT false,
    "er_hjaelper" BOOLEAN NOT NULL DEFAULT false,
    "kontaktperson_navn" TEXT NOT NULL,
    "kontakt_telefon" TEXT NOT NULL,
    "kontakt_email" TEXT NOT NULL,
    "partaftale_hest_id" UUID,
    "partaftale_godkendt_trods_niveau" BOOLEAN NOT NULL DEFAULT false,
    "aktiv_status" "AktivStatus" NOT NULL DEFAULT 'Aktiv',
    "opsigelse_modtaget" DATE,
    "slutdato" DATE,

    CONSTRAINT "rytter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sikkerhedsprofil" (
    "rytter_id" UUID NOT NULL,
    "faldtraume_note" TEXT,
    "angstkategori" TEXT,
    "intern_note" TEXT,
    "forbudte_heste" UUID[] DEFAULT ARRAY[]::UUID[],
    "paakraevede_heste" UUID[] DEFAULT ARRAY[]::UUID[],
    "kun_rolige_heste" BOOLEAN NOT NULL DEFAULT false,
    "opdateret_af" UUID NOT NULL,
    "opdateret" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sikkerhedsprofil_pkey" PRIMARY KEY ("rytter_id")
);

-- CreateTable
CREATE TABLE "hold" (
    "id" UUID NOT NULL,
    "holdnavn" TEXT NOT NULL,
    "niveau" "Niveau" NOT NULL,
    "er_springhold" BOOLEAN NOT NULL DEFAULT false,
    "ugedag" INTEGER NOT NULL,
    "starttid" VARCHAR(5) NOT NULL,
    "varighed_min" INTEGER NOT NULL,
    "max_kapacitet" INTEGER NOT NULL,
    "fast_underviser_id" UUID NOT NULL,

    CONSTRAINT "hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdtilmelding" (
    "id" UUID NOT NULL,
    "rytter_id" UUID NOT NULL,
    "hold_id" UUID NOT NULL,
    "gyldig_fra" DATE NOT NULL,
    "gyldig_til" DATE,
    "ancienitet_dato" DATE NOT NULL,

    CONSTRAINT "holdtilmelding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elevoenske" (
    "id" UUID NOT NULL,
    "rytter_id" UUID NOT NULL,
    "maaned" CHAR(7) NOT NULL,
    "prioritet" INTEGER NOT NULL,
    "oensket_hest_id" UUID NOT NULL,
    "registreret_af" UUID NOT NULL,
    "oprettet" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "elevoenske_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tildelingskoersel" (
    "id" UUID NOT NULL,
    "maaned" CHAR(7) NOT NULL,
    "status" "KoerselStatus" NOT NULL,
    "startet_af" UUID NOT NULL,
    "solver_version" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "varighed_ms" INTEGER NOT NULL,
    "statistik" JSONB NOT NULL,
    "welfare_guard_resultat" JSONB NOT NULL,
    "oprettet" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tildelingskoersel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hestetildeling" (
    "id" UUID NOT NULL,
    "koersel_id" UUID NOT NULL,
    "holdtilmelding_id" UUID NOT NULL,
    "hest_id" UUID,
    "oenske_opfyldt" INTEGER,
    "er_alternativ_tildeling" BOOLEAN NOT NULL,
    "turnus_score" INTEGER NOT NULL,
    "turnus_naeste_maaned" INTEGER NOT NULL,
    "begrundelse_koder" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "begrundelse_tekst" TEXT NOT NULL,
    "manuelt_justeret" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "hestetildeling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lektion" (
    "id" UUID NOT NULL,
    "hold_id" UUID NOT NULL,
    "dato" DATE NOT NULL,
    "underviser_id" UUID NOT NULL,
    "vikar_navn" TEXT,
    "status" "LektionStatus" NOT NULL DEFAULT 'Planlagt',
    "fremmoede_lukket" TIMESTAMPTZ(6),

    CONSTRAINT "lektion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lektionsplads" (
    "id" UUID NOT NULL,
    "lektion_id" UUID NOT NULL,
    "rytter_id" UUID NOT NULL,
    "planlagt_hest_id" UUID,
    "aktuel_hest_id" UUID,
    "kilde" "PladsKilde" NOT NULL DEFAULT 'Plan',
    "felt_tidsstempler" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "lektionsplads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_notifikation" (
    "id" UUID NOT NULL,
    "type" "NotifikationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "oprettet" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kvitteret_af" UUID,
    "kvitteret_tidspunkt" TIMESTAMPTZ(6),
    "dedupe_noegle" TEXT,

    CONSTRAINT "dashboard_notifikation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_haendelse" (
    "id" UUID NOT NULL,
    "server_seq" BIGSERIAL NOT NULL,
    "server_tidspunkt" TIMESTAMPTZ(6) NOT NULL,
    "klient_tidspunkt" TIMESTAMPTZ(6),
    "enhed_id" UUID,
    "bruger_id" UUID,
    "bruger_navn" TEXT NOT NULL,
    "rolle" TEXT NOT NULL,
    "handling" TEXT NOT NULL,
    "entitet" TEXT NOT NULL,
    "entitet_id" TEXT NOT NULL,
    "foer" JSONB,
    "efter" JSONB,
    "begrundelse" TEXT,
    "kommando_id" UUID,
    "forrige_hash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "audit_haendelse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bruger_email_key" ON "bruger"("email");

-- CreateIndex
CREATE UNIQUE INDEX "holdtilmelding_rytter_id_hold_id_gyldig_fra_key" ON "holdtilmelding"("rytter_id", "hold_id", "gyldig_fra");

-- CreateIndex
CREATE UNIQUE INDEX "elevoenske_rytter_id_maaned_prioritet_key" ON "elevoenske"("rytter_id", "maaned", "prioritet");

-- CreateIndex
CREATE UNIQUE INDEX "elevoenske_rytter_id_maaned_oensket_hest_id_key" ON "elevoenske"("rytter_id", "maaned", "oensket_hest_id");

-- CreateIndex
CREATE INDEX "tildelingskoersel_maaned_idx" ON "tildelingskoersel"("maaned");

-- CreateIndex
CREATE UNIQUE INDEX "hestetildeling_koersel_id_holdtilmelding_id_key" ON "hestetildeling"("koersel_id", "holdtilmelding_id");

-- CreateIndex
CREATE UNIQUE INDEX "lektion_hold_id_dato_key" ON "lektion"("hold_id", "dato");

-- CreateIndex
CREATE UNIQUE INDEX "lektionsplads_lektion_id_rytter_id_key" ON "lektionsplads"("lektion_id", "rytter_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_haendelse_server_seq_key" ON "audit_haendelse"("server_seq");

-- CreateIndex
CREATE INDEX "audit_haendelse_handling_idx" ON "audit_haendelse"("handling");

-- CreateIndex
CREATE INDEX "audit_haendelse_entitet_id_idx" ON "audit_haendelse"("entitet_id");

-- AddForeignKey
ALTER TABLE "rytter" ADD CONSTRAINT "rytter_partaftale_hest_id_fkey" FOREIGN KEY ("partaftale_hest_id") REFERENCES "hest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sikkerhedsprofil" ADD CONSTRAINT "sikkerhedsprofil_rytter_id_fkey" FOREIGN KEY ("rytter_id") REFERENCES "rytter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sikkerhedsprofil" ADD CONSTRAINT "sikkerhedsprofil_opdateret_af_fkey" FOREIGN KEY ("opdateret_af") REFERENCES "bruger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hold" ADD CONSTRAINT "hold_fast_underviser_id_fkey" FOREIGN KEY ("fast_underviser_id") REFERENCES "bruger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdtilmelding" ADD CONSTRAINT "holdtilmelding_rytter_id_fkey" FOREIGN KEY ("rytter_id") REFERENCES "rytter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdtilmelding" ADD CONSTRAINT "holdtilmelding_hold_id_fkey" FOREIGN KEY ("hold_id") REFERENCES "hold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elevoenske" ADD CONSTRAINT "elevoenske_rytter_id_fkey" FOREIGN KEY ("rytter_id") REFERENCES "rytter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elevoenske" ADD CONSTRAINT "elevoenske_oensket_hest_id_fkey" FOREIGN KEY ("oensket_hest_id") REFERENCES "hest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elevoenske" ADD CONSTRAINT "elevoenske_registreret_af_fkey" FOREIGN KEY ("registreret_af") REFERENCES "bruger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tildelingskoersel" ADD CONSTRAINT "tildelingskoersel_startet_af_fkey" FOREIGN KEY ("startet_af") REFERENCES "bruger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hestetildeling" ADD CONSTRAINT "hestetildeling_koersel_id_fkey" FOREIGN KEY ("koersel_id") REFERENCES "tildelingskoersel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hestetildeling" ADD CONSTRAINT "hestetildeling_holdtilmelding_id_fkey" FOREIGN KEY ("holdtilmelding_id") REFERENCES "holdtilmelding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hestetildeling" ADD CONSTRAINT "hestetildeling_hest_id_fkey" FOREIGN KEY ("hest_id") REFERENCES "hest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lektion" ADD CONSTRAINT "lektion_hold_id_fkey" FOREIGN KEY ("hold_id") REFERENCES "hold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lektion" ADD CONSTRAINT "lektion_underviser_id_fkey" FOREIGN KEY ("underviser_id") REFERENCES "bruger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lektionsplads" ADD CONSTRAINT "lektionsplads_lektion_id_fkey" FOREIGN KEY ("lektion_id") REFERENCES "lektion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lektionsplads" ADD CONSTRAINT "lektionsplads_rytter_id_fkey" FOREIGN KEY ("rytter_id") REFERENCES "rytter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lektionsplads" ADD CONSTRAINT "lektionsplads_planlagt_hest_id_fkey" FOREIGN KEY ("planlagt_hest_id") REFERENCES "hest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lektionsplads" ADD CONSTRAINT "lektionsplads_aktuel_hest_id_fkey" FOREIGN KEY ("aktuel_hest_id") REFERENCES "hest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_notifikation" ADD CONSTRAINT "dashboard_notifikation_kvitteret_af_fkey" FOREIGN KEY ("kvitteret_af") REFERENCES "bruger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_haendelse" ADD CONSTRAINT "audit_haendelse_bruger_id_fkey" FOREIGN KEY ("bruger_id") REFERENCES "bruger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Håndskrevne regler, som Prisma ikke kan udtrykke i schema.prisma (T018)
-- ============================================================================

-- (a) CHECK-regler fra data-model.md
ALTER TABLE "hest" ADD CONSTRAINT "hest_stangmaal_check" CHECK ("stangmaal_cm" BETWEEN 80 AND 190);
ALTER TABLE "hest" ADD CONSTRAINT "hest_max_lektioner_dag_check" CHECK ("max_lektioner_dag" <= CASE WHEN "skaane" THEN 2 ELSE 3 END);
ALTER TABLE "hest" ADD CONSTRAINT "hest_max_spring_uge_check" CHECK ("max_spring_uge" IN (0, 1));
ALTER TABLE "hest" ADD CONSTRAINT "hest_springforbud_check" CHECK (NOT "springforbud" OR "max_spring_uge" = 0);
ALTER TABLE "hest" ADD CONSTRAINT "hest_hviledag_check" CHECK ("hviledag" BETWEEN 1 AND 7);
ALTER TABLE "hold" ADD CONSTRAINT "hold_ugedag_check" CHECK ("ugedag" BETWEEN 1 AND 7);
ALTER TABLE "hold" ADD CONSTRAINT "hold_varighed_check" CHECK ("varighed_min" BETWEEN 30 AND 60);
ALTER TABLE "hold" ADD CONSTRAINT "hold_max_kapacitet_check" CHECK ("max_kapacitet" BETWEEN 1 AND 10);
ALTER TABLE "hold" ADD CONSTRAINT "hold_starttid_check" CHECK ("starttid" ~ '^[0-2][0-9]:[0-5][0-9]$');
ALTER TABLE "elevoenske" ADD CONSTRAINT "elevoenske_prioritet_check" CHECK ("prioritet" IN (1, 2, 3));
ALTER TABLE "elevoenske" ADD CONSTRAINT "elevoenske_maaned_check" CHECK ("maaned" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "tildelingskoersel" ADD CONSTRAINT "tildelingskoersel_maaned_check" CHECK ("maaned" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "hestetildeling" ADD CONSTRAINT "hestetildeling_oenske_opfyldt_check" CHECK ("oenske_opfyldt" IS NULL OR "oenske_opfyldt" IN (1, 2, 3));
ALTER TABLE "bruger" ADD CONSTRAINT "bruger_roller_check" CHECK (cardinality("roller") >= 1);

-- (b) Partielle unikke indeks
CREATE UNIQUE INDEX "hest_navn_aktiv_key" ON "hest" (lower("navn")) WHERE "aktiv";
-- Højst én Publiceret kørsel pr. måned
CREATE UNIQUE INDEX "tildelingskoersel_publiceret_key" ON "tildelingskoersel" ("maaned") WHERE "status" = 'Publiceret';
-- Samme hest kan ikke være aktuel hest på to pladser i samme lektion
CREATE UNIQUE INDEX "lektionsplads_aktuel_hest_key" ON "lektionsplads" ("lektion_id", "aktuel_hest_id") WHERE "aktuel_hest_id" IS NOT NULL;
CREATE UNIQUE INDEX "dashboard_notifikation_dedupe_key" ON "dashboard_notifikation" ("dedupe_noegle") WHERE "kvitteret_tidspunkt" IS NULL AND "dedupe_noegle" IS NOT NULL;

-- (c) Append-only (Princip III). Funktionen genbruges af de øvrige 🧾-tabeller i Fase 2.
CREATE FUNCTION afvis_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only: % må ikke ændres eller slettes', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER "audit_haendelse_append_only"
  BEFORE UPDATE OR DELETE ON "audit_haendelse"
  FOR EACH ROW EXECUTE FUNCTION afvis_mutation();
