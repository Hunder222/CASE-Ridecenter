import { execSync } from 'node:child_process';

// Nulstiller databasen og seeder casens fredagsdata før E2E-testene (quickstart V2).
export default function globalSetup(): void {
  execSync('npm run db:seed -- --scenarie=fredag --nulstil', { stdio: 'inherit' });
}
