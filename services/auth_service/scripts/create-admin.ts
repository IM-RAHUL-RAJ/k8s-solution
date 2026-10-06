/**
 * Creates (or resets) an admin. Registration through the API only makes customers by default,
 * and an admin needs the ADMIN role, so this sets it directly in the database.
 *
 *   ADMIN_PASSWORD='a long password' npm run create-admin -- <username> <accountId>
 *
 * <accountId> is any existing account id: it is what the admin's token carries, and the admin
 * only ever gets read access to accounts. Uses the same DB_* variables as the service.
 */
import * as argon2 from 'argon2';
import { Client } from 'pg';

async function main() {
    const [username, accountIdArg] = process.argv.slice(2);
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !accountIdArg || !password) {
        console.error('Usage: ADMIN_PASSWORD=... npm run create-admin -- <username> <accountId>');
        process.exit(1);
    }
    if (password.length < 12) {
        console.error('ADMIN_PASSWORD must be at least 12 characters.');
        process.exit(1);
    }

    const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
    });

    const client = new Client({
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME ?? 'springboot_db',
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD,
    });
    await client.connect();
    try {
        await client.query(
            `INSERT INTO auth_users (username, password_hash, account_id, roles)
             VALUES ($1, $2, $3, ARRAY['ADMIN'])
             ON CONFLICT (username)
             DO UPDATE SET password_hash = EXCLUDED.password_hash, roles = ARRAY['ADMIN']`,
            [username, passwordHash, Number(accountIdArg)],
        );
        console.log(`Admin '${username}' is ready.`);
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
