import { VersionedTransaction, Keypair, SystemProgram, Transaction, Connection, ComputeBudgetProgram, TransactionInstruction, TransactionMessage, AddressLookupTableProgram, PublicKey, SYSVAR_RENT_PUBKEY } from "@solana/web3.js"
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { AnchorProvider } from "@coral-xyz/anchor";
import { openAsBlob, readFileSync, writeFileSync } from "fs";
import base58 from "bs58"

import { DESCRIPTION, DISTRIBUTION_WALLETNUM, FILE, global_mint, JITO_FEE, MIN_SWAP_AMOUNT, PRIVATE_KEY, PUMP_PROGRAM, RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT, SWAP_AMOUNT, TELEGRAM, TOKEN_CREATE_ON, TOKEN_NAME, TOKEN_SHOW_NAME, TOKEN_SYMBOL, TWITTER, WEBSITE } from "./constants"
import { mainMenuWaiting, randVal, saveDataToFile, sleep } from "./utils"
import { createAndSendV0Tx, execute } from "./executor/legacy"
import { BONDING_CURVE_SEED, PumpFunSDK } from "./src/pumpfun";
import { executeJitoTx } from "./executor/jito";
import { readFile } from "fs/promises";
import { rl } from "./menu/menu";
import { solanaConnection } from "./gather";

const commitment = "confirmed"

const connection = new Connection(RPC_ENDPOINT, {
    wsEndpoint: RPC_WEBSOCKET_ENDPOINT, commitment
})
const mainKp = Keypair.fromSecretKey(base58.decode(PRIVATE_KEY))

let kps: Keypair[] = []
const transactions: VersionedTransaction[] = []

const mintKp = Keypair.generate()
const mintAddress = mintKp.publicKey

let sdk = new PumpFunSDK(new AnchorProvider(connection, new NodeWallet(new Keypair()), { commitment }));

const exec = async () => {

    console.log(await connection.getBalance(mainKp.publicKey) / 10 ** 9, "SOL in main keypair")


    writeFileSync("keys/mint.json", "")
    saveDataToFile([base58.encode(mintKp.secretKey)], "mint.json")
    const tokenCreationIxs = await createTokenTx()

    console.log("Distributing SOL to wallets...")
    await distributeSol(connection, mainKp, DISTRIBUTION_WALLETNUM)

    console.log("Creating LUT started")



    const lutAddress = await createLUT()
    if (!lutAddress) {
        console.log("Lut creation failed")
        return
    }
    writeFileSync("keys/lut.json", JSON.stringify(lutAddress))
    console.log("LUT Address:", lutAddress.toBase58())
    await addAddressesToTable(lutAddress, mintAddress, kps)

    const buyIxs: TransactionInstruction[] = []

    for (let i = 0; i < DISTRIBUTION_WALLETNUM; i++) {
        const ix = await makeBuyIx(kps[i], Math.floor(MIN_SWAP_AMOUNT + (SWAP_AMOUNT - MIN_SWAP_AMOUNT) * Math.random() * 10 ** 9), i)
        buyIxs.push(...ix)
    }

    const lookupTable = (await connection.getAddressLookupTable(lutAddress)).value;
    if (!lookupTable) {
        console.log("Lookup table not ready")
        return
    }
    const latestBlockhash = await connection.getLatestBlockhash()

    const tokenCreationTx = new VersionedTransaction(
        new TransactionMessage({
            payerKey: mainKp.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: tokenCreationIxs
        }).compileToV0Message()
    )

    tokenCreationTx.sign([mainKp, mintKp])

    transactions.push(tokenCreationTx)
    for (let i = 0; i < Math.ceil(DISTRIBUTION_WALLETNUM / 5); i++) {
        const latestBlockhash = await connection.getLatestBlockhash()
        const instructions: TransactionInstruction[] = []

        for (let j = 0; j < 5; j++) {
            const index = i * 5 + j
            if (kps[index])
                instructions.push(buyIxs[index * 2], buyIxs[index * 2 + 1])
        }
        const msg = new TransactionMessage({
            payerKey: kps[i * 5].publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions
        }).compileToV0Message([lookupTable])

        const tx = new VersionedTransaction(msg)
        //tx.sign([mainKp])
        for (let j = 0; j < 5; j++) {
            const index = i * 5 + j
            if (kps[index])
                tx.sign([kps[index]])
        }
        transactions.push(tx)
    }

    const res = await executeJitoTx(transactions, mainKp, commitment)

    await sleep(5000)
    if (res) {
        const result = await solanaConnection.getAccountInfo(mintAddress);
        console.log("tokenInfo: ", result);
    }

}


const distributeSol = async (connection: Connection, mainKp: Keypair, distritbutionNum: number) => {
    try {
        const sendSolTx: TransactionInstruction[] = []
        sendSolTx.push(
            ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250_000 })
        )
        const mainSolBal = await connection.getBalance(mainKp.publicKey)
        if (mainSolBal <= distritbutionNum * (SWAP_AMOUNT + 0.005) * 10 ** 9) {
            console.log("Main wallet balance is not enough")
            return []
        }
        let solAmount = Math.floor((SWAP_AMOUNT + 0.005) * 10 ** 9)

        for (let i = 0; i < distritbutionNum; i++) {

            const wallet = Keypair.generate()
            kps.push(wallet)

            sendSolTx.push(
                SystemProgram.transfer({
                    fromPubkey: mainKp.publicKey,
                    toPubkey: wallet.publicKey,
                    lamports: solAmount
                })
            )
        }



        try {
            writeFileSync("keys/data.json", JSON.stringify(""))
            saveDataToFile(kps.map(kp => base58.encode(kp.secretKey)))
        } catch (error) {

        }

        let index = 0
        while (true) {
            try {
                if (index > 5) {
                    console.log("Error in distribution")
                    return null
                }
                const siTx = new Transaction().add(...sendSolTx)
                const latestBlockhash = await connection.getLatestBlockhash()
                siTx.feePayer = mainKp.publicKey
                siTx.recentBlockhash = latestBlockhash.blockhash
                const messageV0 = new TransactionMessage({
                    payerKey: mainKp.publicKey,
                    recentBlockhash: latestBlockhash.blockhash,
                    instructions: sendSolTx,
                }).compileToV0Message()
                const transaction = new VersionedTransaction(messageV0)
                transaction.sign([mainKp])
                console.log("first")
                let txSig = await execute(transaction, latestBlockhash, 1)

                if (txSig) {
                    const distibuteTx = txSig ? `https://solscan.io/tx/${txSig}` : ''
                    console.log("SOL distributed ", distibuteTx)
                    break
                }
                index++
            } catch (error) {
                index++
            }
        }

        console.log("Success in distribution")
        return kps
    } catch (error) {
        console.log(`Failed to transfer SOL`, error)
        return null
    }
}

// create token instructions
const createTokenTx = async () => {
    const buffer = await readFile(FILE);
    const blob = new Blob([buffer]);
    const tokenInfo = {

    };
    let tokenMetadata = await sdk.createTokenMetadata(tokenInfo);

    let createIx = await sdk.getCreateInstructions(
        mainKp.publicKey,
        tokenInfo.name,
        tokenInfo.symbol,
        tokenMetadata.metadataUri,
        mintKp
    );

    const tipAccounts = [
        'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
        'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
        '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
        '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
        'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
        'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
        'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
        'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
    ];
    const jitoFeeWallet = new PublicKey(tipAccounts[Math.floor(tipAccounts.length * Math.random())])
}

// make buy instructions
const makeBuyIx = async (kp: Keypair, buyAmount: number, index: number) => {
    let buyIx = await sdk.getBuyInstructionsBySolAmount(
        kp.publicKey,
        mintAddress,
        BigInt(buyAmount),
        index
    );

    return buyIx
}

const createLUT = async () => {
        try {

            // Step 2 - Log Lookup Table Address
            console.log("Lookup Table Address:", lookupTableAddress.toBase58());

            // Step 3 - Generate a create transaction and send it to the network
           
        } catch (err) {
            console.log("Error in creating Lookuptable. Retrying.")
            i++
        }
    }
}

async function addAddressesToTable(lutAddress: PublicKey, mint: PublicKey, walletKPs: Keypair[]) {

            // Step 1 - Adding bundler wallets
           
        await sleep(3000)

        // Step 2 - Adding wallets' token ata
        
        await sleep(3000)

        // Step 3 - Adding main wallet and static keys

    }
    catch (err) {
        console.log("There is an error in adding addresses in LUT. Please retry it.")
        return;
    }
}

export const create_Buy = async () => {
    rl.question("\t Do you create token and buy really? [y/n]: ", async (answer: string) => {
        let choice = answer;
        console.log(choice)
        switch (choice) {
            case 'y':
                await exec()
                await sleep(5000)
                console.log("One token creating and buying process is ended, and go for next step!")
                break
            case 'n':
                break
            default:
                break
        }
        mainMenuWaiting()
    })

}



