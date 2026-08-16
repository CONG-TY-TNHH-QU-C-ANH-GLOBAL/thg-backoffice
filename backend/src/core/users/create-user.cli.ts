/**
 * Bootstrap the first user: `npm run user:create -- --email a@b.c --name "A B"`
 *
 * A CLI rather than an endpoint, and rather than a seed in a migration:
 *
 *   not an endpoint  creating users over HTTP needs an answer to "who may do
 *                    this", and that is authorization — a later phase. An open
 *                    endpoint now would be the hole this phase exists to avoid.
 *
 *   not a migration  a user is data, not schema. Seeding one bakes a known
 *                    account into every deployment of this foundation, which
 *                    is how a shared default password ends up in production.
 *
 * The password is read from a prompt or the BOOTSTRAP_PASSWORD variable, never
 * from an argument: argv is visible in `ps` and lands in shell history.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { UserService } from './user.service';

interface Args {
  email?: string;
  name?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--email') args.email = argv[i + 1];
    if (argv[i] === '--name') args.name = argv[i + 1];
  }
  return args;
}

async function readPassword(): Promise<string> {
  const fromEnv = process.env['BOOTSTRAP_PASSWORD'];
  if (fromEnv) return fromEnv;

  process.stdout.write('Password (input is not hidden): ');
  return new Promise((resolve) => {
    process.stdin.once('data', (data) => resolve(data.toString().trim()));
  });
}

async function main(): Promise<void> {
  const { email, name } = parseArgs(process.argv.slice(2));

  if (!email || !name) {
    console.error('Usage: npm run user:create -- --email <email> --name "<display name>"');
    console.error('Password is read from BOOTSTRAP_PASSWORD, or prompted for.');
    process.exit(1);
  }

  const password = await readPassword();
  if (password.length < 12) {
    // Not a policy engine — one floor, applied where the first account is made.
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });

  try {
    const user = await app.get(UserService).createWithPassword({
      displayName: name,
      subject: email,
      password,
    });
    console.log(`Created user ${user.id} (${user.displayName}).`);
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
