import { VersionedTransaction, Keypair, SystemProgram, Connection, TransactionInstruction, TransactionMessage, PublicKey } from "@solana/web3.js"
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { AnchorProvider } from "@coral-xyz/anchor";
import base58 from "bs58"
import { DISTRIBUTION_WALLETNUM, JITO_FEE, PRIVATE_KEY, RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT } from "./constants"
import { mainMenuWaiting, readJson, sleep } from "./utils"
import { PumpFunSDK } from "./src/pumpfun";
import { executeJitoTx } from "./executor/jito";
import { getSPLBalance } from "./src/util";
import { readFileSync } from "fs";
import { rl } from "./menu/menu";

const commitment = "confirmed"

const connection = new Connection(RPC_ENDPOINT, {
    wsEndpoint: RPC_WEBSOCKET_ENDPOINT, commitment
})
let sdk = new PumpFunSDK(new AnchorProvider(connection, new NodeWallet(new Keypair()), { commitment }));

const exec = async (walletNumKps: Keypair[]) => {

    try {
        const mintKpStr = JSON.parse(readFileSync("keys/mint.json", "utf-8"));
        if (!mintKpStr) {
            return;
        }

        const mainKp = Keypair.fromSecretKey(base58.decode(PRIVATE_KEY))
        const mintkP = Keypair.fromSecretKey(base58.decode(mintKpStr))
        const mintAddress = mintkP.publicKey


        let kps: Keypair[] = walletNumKps
        kps.map(async (kp) => console.log(await connection.getBalance(kp.publicKey) / 10 ** 9))

        const lutAddress = JSON.parse(readFileSync("keys/lut.json", "utf-8"));
        if (!lutAddress) {
            return
        }
        console.log("lutAddress:", lutAddress)
        // const lutAddress = new PublicKey("5RTVEUjSik9p6M5vKQJk1X7WewFvtiRb4Ar7koPcAyi2")
        const lookupTable = (await connection.getAddressLookupTable(new PublicKey(lutAddress))).value;
        if (!lookupTable) {
            return
        }

        const sellIxs: TransactionInstruction[] = []
        for (let i = 0; i < kps.length; i++) {
            const sellAmount = await getSPLBalance(connection, mintAddress, kps[i].publicKey)
            if (!sellAmount) continue
            const ix = await makeSellIx(kps[i], sellAmount * 10 ** 6, mintAddress)
            sellIxs.push(ix.instructions[0])

        }
        if (!lookupTable) {
            console.log("Lookup table not ready")
            return
        }

        const latestBlockhash = await connection.getLatestBlockhash()
        const transactions: VersionedTransaction[] = [];
        const jitofeeixs = await jitoTxsignature(mainKp);

        const jitoTx = new VersionedTransaction(
            new TransactionMessage({
                payerKey: mainKp.publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: jitofeeixs
            }).compileToV0Message()
        )
        transactions.push(jitoTx)
        for (let i = 0; i < Math.ceil(kps.length / 5); i++) {
            const instructions: TransactionInstruction[] = [];

            const start = i * 5
            const end = (i + 1) * 5 < kps.length ? (i + 1) * 5 : kps.length
            for (let j = start; j < end; j++)
                instructions.push(sellIxs[j])

            transactions.push(new VersionedTransaction(
                new TransactionMessage({
                    payerKey: mainKp.publicKey,
                    recentBlockhash: latestBlockhash.blockhash,
                    instructions: instructions
                }).compileToV0Message([lookupTable])
            ))
            sleep(1000);
        }
        transactions[0].sign([mainKp])
        for (let j = 1; j < transactions.length; j++) {
            transactions[j].sign([mainKp])
            for (let i = 0; i < 5; i++) {
                if ((j - 1) * 5 + i == kps.length) {
                    break
                }
                transactions[j].sign([kps[(j - 1) * 5 + i]])
            }

        }

        await executeJitoTx(transactions, mainKp, commitment)

        await sleep(10000)
    } catch (error) {
        console.log("You don't create token and buy yet.\nfirst you have to go step 1\n")
    }


}
// jito FEE
const jitoTxsignature = async (mainKp: Keypair) => {
    const ixs: TransactionInstruction[] = []
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
    ixs.push(SystemProgram.transfer({
        fromPubkey: mainKp.publicKey,
        toPubkey: jitoFeeWallet,
        lamports: Math.floor(JITO_FEE * 10 ** 9),
    }))
    return ixs
}
// make sell instructions
const makeSellIx = async (kp: Keypair, sellAmount: number, mintAddress: PublicKey) => {
    let sellIx = await sdk.getSellInstructionsByTokenAmount(
        kp.publicKey,
        mintAddress,
        BigInt(sellAmount),
        BigInt(1000),
        commitment
    );
    return sellIx
}

export const sell = async () => {

    let kps: Keypair[] = []
    kps = readJson().map(kpStr => Keypair.fromSecretKey(base58.decode(kpStr)))
    kps.map(async (kp, index) => console.log(`${index}:  ${kp.publicKey} got ${await connection.getBalance(kp.publicKey) / 10 ** 9})`))
    console.log("input wallet number to sell")
    rl.question("\t Input wallets [ex: 1,3,5,6]: \n", async (answer: string) => {
        let countStr: string[] = answer.split(",")
        console.log(countStr)
        const tempKps: Keypair[] = [];
        countStr.map(data => {
            tempKps.push(kps[parseInt(data)])
        })

        await exec(tempKps)
        await sleep(5000)
        mainMenuWaiting()
    })

}

