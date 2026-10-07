-- CreateEnum
CREATE TYPE "VikarKodeStatus" AS ENUM ('Aktiv', 'Anvendt', 'Udloebet', 'Spaerret');

-- CreateEnum
CREATE TYPE "StatusMeldingType" AS ENUM ('Helbred', 'Adfaerd');

-- CreateEnum
CREATE TYPE "Alvorlighed" AS ENUM ('Info', 'Obs', 'KanIkkeBruges');

-- CreateEnum
CREATE TYPE "CheatSheetKategori" AS ENUM ('Haandtering', 'Afstand', 'Opstigning', 'Kommunikation');

-- CreateEnum
CREATE TYPE "FremmoedeStatus" AS ENUM ('Fremmoedt', 'Afbud_rettidigt', 'Afbud_for_sent', 'Udeblevet');

-- CreateEnum
CREATE TYPE "OmplaceringsAarsag" AS ENUM ('HestSyg', 'HestSkadet', 'Adfaerd', 'Andet');

-- CreateEnum
CREATE TYPE "VentelisteStatus" AS ENUM ('Aktiv', 'Forslag_genereret', 'Optaget', 'Afslaaet');

-- CreateEnum
CREATE TYPE "GenbesaettelseType" AS ENUM ('Enkeltlektion', 'FastPlads');

-- CreateEnum
CREATE TYPE "GenbesaettelseStatus" AS ENUM ('Afventer', 'Godkendt', 'Afvist', 'Udloebet');

-- CreateEnum
CREATE TYPE "RapportFormat" AS ENUM ('CSV', 'HTML');

-- AlterTable
ALTER TABLE "sikkerhedsprofil" ADD COLUMN     "adfaerdsinstruks" TEXT,
ADD COLUMN     "cheat_sheet_koder" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "enhed" (
    "id" UUID NOT NULL,
    "navn" TEXT NOT NULL,
    "enrollment_token_hash" TEXT NOT NULL,
    "enhedsnoegle_hash" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "sidst_synkroniseret" TIMESTAMPTZ(6),

    CONSTRAINT "enhed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vikar_engangskode" (
    "id" UUID NOT NULL,
    "kode_hash" TEXT NOT NULL,
    "udstedt_af" UUID NOT NULL,
    "udstedt_dato" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "udloebsdato" TIMESTAMPTZ(6) NOT NULL,
    "anvendt_dato" TIMESTAMPTZ(6),
    "anvendt_af_vikarnavn" TEXT,
    "anvendt_paa_enhed" UUID,
    "status" "VikarKodeStatus" NOT NULL DEFAULT 'Aktiv',

    CONSTRAINT "vikar_engangskode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hestestatusmelding" (
    "id" UUID NOT NULL,
    "hest_id" UUID NOT NULL,
    "type" "StatusMeldingType" NOT NULL,
    "alvorlighed" "Alvorlighed" NOT NULL,
    "beskrivelse" TEXT NOT NULL,
    "meldt_af_bruger_id" UUID,
    "meldt_af_navn" TEXT NOT NULL,
    "klient_tidspunkt" TIMESTAMPTZ(6) NOT NULL,
    "server_tidspunkt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kommando_id" UUID NOT NULL,

    CONSTRAINT "hestestatusmelding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheat_sheet_kode" (
    "kode" TEXT NOT NULL,
    "tekst" TEXT NOT NULL,
    "kategori" "CheatSheetKategori" NOT NULL,

    CONSTRAINT "cheat_sheet_kode_pkey" PRIMARY KEY ("kode")
);

-- CreateTable
CREATE TABLE "fremmoederegistrering" (
    "id" UUID NOT NULL,
    "lektionsplads_id" UUID NOT NULL,
    "lektion_dato" DATE NOT NULL,
    "hold_id" UUID NOT NULL,
    "rytter_id" UUID NOT NULL,
    "hest_id" UUID,
    "status" "FremmoedeStatus" NOT NULL,
    "modtaget_tidspunkt" TIMESTAMPTZ(6),
    "registreret_af_bruger_id" UUID,
    "registreret_af_navn" TEXT NOT NULL,
    "klient_tidspunkt" TIMESTAMPTZ(6) NOT NULL,
    "server_tidspunkt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enhed_id" UUID,
    "erstatter_id" UUID,
    "korrektions_begrundelse" TEXT,
    "kommando_id" UUID NOT NULL,
    "forrige_hash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "fremmoederegistrering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "omplacering" (
    "id" UUID NOT NULL,
    "lektionsplads_id" UUID NOT NULL,
    "fra_hest_id" UUID NOT NULL,
    "til_hest_id" UUID NOT NULL,
    "aarsag" "OmplaceringsAarsag" NOT NULL,
    "forslag_snapshot" JSONB NOT NULL,
    "godkendt_af_bruger_id" UUID,
    "godkendt_af_navn" TEXT NOT NULL,
    "klient_tidspunkt" TIMESTAMPTZ(6) NOT NULL,
    "server_tidspunkt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kommando_id" UUID NOT NULL,

    CONSTRAINT "omplacering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venteliste" (
    "id" UUID NOT NULL,
    "rytter_id" UUID NOT NULL,
    "oensket_hold_id" UUID,
    "oensket_niveau" "Niveau",
    "tilmeldingsdato" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "VentelisteStatus" NOT NULL DEFAULT 'Aktiv',

    CONSTRAINT "venteliste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genbesaettelsesforslag" (
    "id" UUID NOT NULL,
    "type" "GenbesaettelseType" NOT NULL,
    "lektion_id" UUID,
    "hold_id" UUID,
    "ledig_fra" DATE,
    "frigjort_hest_id" UUID,
    "foreslaaet_venteliste_id" UUID NOT NULL,
    "kontaktinfo_snapshot" JSONB NOT NULL,
    "status" "GenbesaettelseStatus" NOT NULL DEFAULT 'Afventer',
    "behandlet_af" UUID,
    "behandlet_tidspunkt" TIMESTAMPTZ(6),

    CONSTRAINT "genbesaettelsesforslag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rapport_udtraek" (
    "id" UUID NOT NULL,
    "periode_fra" DATE NOT NULL,
    "periode_til" DATE NOT NULL,
    "aldersgraense" INTEGER NOT NULL DEFAULT 25,
    "format" "RapportFormat" NOT NULL,
    "antal_raekker" INTEGER NOT NULL,
    "fil_sha256" TEXT NOT NULL,
    "kaede_hovedhash" TEXT NOT NULL,
    "genereret_af" UUID NOT NULL,
    "genereret_tidspunkt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "varighed_ms" INTEGER NOT NULL,

    CONSTRAINT "rapport_udtraek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vikar_engangskode_kode_hash_idx" ON "vikar_engangskode"("kode_hash");

-- CreateIndex
CREATE UNIQUE INDEX "hestestatusmelding_kommando_id_key" ON "hestestatusmelding"("kommando_id");

-- CreateIndex
CREATE UNIQUE INDEX "fremmoederegistrering_kommando_id_key" ON "fremmoederegistrering"("kommando_id");

-- CreateIndex
CREATE INDEX "fremmoederegistrering_lektionsplads_id_idx" ON "fremmoederegistrering"("lektionsplads_id");

-- CreateIndex
CREATE INDEX "fremmoederegistrering_lektion_dato_idx" ON "fremmoederegistrering"("lektion_dato");

-- CreateIndex
CREATE UNIQUE INDEX "omplacering_kommando_id_key" ON "omplacering"("kommando_id");

-- AddForeignKey
ALTER TABLE "audit_haendelse" ADD CONSTRAINT "audit_haendelse_enhed_id_fkey" FOREIGN KEY ("enhed_id") REFERENCES "enhed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vikar_engangskode" ADD CONSTRAINT "vikar_engangskode_udstedt_af_fkey" FOREIGN KEY ("udstedt_af") REFERENCES "bruger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vikar_engangskode" ADD CONSTRAINT "vikar_engangskode_anvendt_paa_enhed_fkey" FOREIGN KEY ("anvendt_paa_enhed") REFERENCES "enhed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hestestatusmelding" ADD CONSTRAINT "hestestatusmelding_hest_id_fkey" FOREIGN KEY ("hest_id") REFERENCES "hest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fremmoederegistrering" ADD CONSTRAINT "fremmoederegistrering_lektionsplads_id_fkey" FOREIGN KEY ("lektionsplads_id") REFERENCES "lektionsplads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fremmoederegistrering" ADD CONSTRAINT "fremmoederegistrering_enhed_id_fkey" FOREIGN KEY ("enhed_id") REFERENCES "enhed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fremmoederegistrering" ADD CONSTRAINT "fremmoederegistrering_erstatter_id_fkey" FOREIGN KEY ("erstatter_id") REFERENCES "fremmoederegistrering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "omplacering" ADD CONSTRAINT "omplacering_lektionsplads_id_fkey" FOREIGN KEY ("lektionsplads_id") REFERENCES "lektionsplads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venteliste" ADD CONSTRAINT "venteliste_rytter_id_fkey" FOREIGN KEY ("rytter_id") REFERENCES "rytter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genbesaettelsesforslag" ADD CONSTRAINT "genbesaettelsesforslag_foreslaaet_venteliste_id_fkey" FOREIGN KEY ("foreslaaet_venteliste_id") REFERENCES "venteliste"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapport_udtraek" ADD CONSTRAINT "rapport_udtraek_genereret_af_fkey" FOREIGN KEY ("genereret_af") REFERENCES "bruger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ======================================================================
-- Håndskrevet del (T106): append-only-triggere, CHECK-regler, partielle indeks
-- ======================================================================

-- (a) Append-only (Princip III). afvis_mutation() er oprettet i init-migrationen.
CREATE TRIGGER fremmoederegistrering_append_only
  BEFORE UPDATE OR DELETE ON "fremmoederegistrering"
  FOR EACH ROW EXECUTE FUNCTION afvis_mutation();

CREATE TRIGGER omplacering_append_only
  BEFORE UPDATE OR DELETE ON "omplacering"
  FOR EACH ROW EXECUTE FUNCTION afvis_mutation();

CREATE TRIGGER hestestatusmelding_append_only
  BEFORE UPDATE OR DELETE ON "hestestatusmelding"
  FOR EACH ROW EXECUTE FUNCTION afvis_mutation();

CREATE TRIGGER rapport_udtraek_append_only
  BEFORE UPDATE OR DELETE ON "rapport_udtraek"
  FOR EACH ROW EXECUTE FUNCTION afvis_mutation();

-- (b) CHECK-regler
ALTER TABLE "hestestatusmelding"
  ADD CONSTRAINT "hestestatusmelding_beskrivelse_max_500" CHECK (length("beskrivelse") <= 500);

ALTER TABLE "fremmoederegistrering"
  ADD CONSTRAINT "fremmoederegistrering_korrektion_begrundelse"
  CHECK ("erstatter_id" IS NULL OR ("korrektions_begrundelse" IS NOT NULL AND length(btrim("korrektions_begrundelse")) >= 5));

ALTER TABLE "venteliste"
  ADD CONSTRAINT "venteliste_hold_eller_niveau" CHECK ("oensket_hold_id" IS NOT NULL OR "oensket_niveau" IS NOT NULL);

ALTER TABLE "sikkerhedsprofil"
  ADD CONSTRAINT "sikkerhedsprofil_cheat_sheet_koder_maks" CHECK (cardinality("cheat_sheet_koder") <= 20);

-- (c) Partielle indeks
CREATE INDEX "venteliste_aktiv_idx" ON "venteliste" ("rytter_id", "oensket_hold_id") WHERE "status" = 'Aktiv';
CREATE INDEX "genbesaettelsesforslag_afventer_idx" ON "genbesaettelsesforslag" ("lektion_id") WHERE "status" = 'Afventer';
CREATE INDEX "vikar_engangskode_aktiv_idx" ON "vikar_engangskode" ("kode_hash") WHERE "status" = 'Aktiv';
