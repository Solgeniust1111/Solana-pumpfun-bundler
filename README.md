# Solana Pumpfun Bundler using JITO & LOOKUPTABLE

## Contact

telegram: @

You can contact me here if you have any problems with this repo then we can decide comfortable contact way.

## Sample

New Token

https://solscan.io/token/78PGu1c3j9Dtb8TVUEufcie5t6rqsm6VuuDrnMzAEKuk
https://pump.fun/coin/78PGu1c3j9Dtb8TVUEufcie5t6rqsm6VuuDrnMzAEKuk

Create token and bundle buy Jito transaction

https://explorer.jito.wtf/bundle/bhudHJRT129UVUptd31KqVszpEi7WQMGnDFnPM3qEEr88ZgvJ9wo21Z4MKKbmLAP27fQdc6TWqQgpYjmeB2qXts

bundle Sell Jito transaction

https://explorer.jito.wtf/bundle/M9TEvmcVK288s7sw7BTbPPy1fEHbNh4hEAeijHVjRV2tWWCTLo27jMShUuLU7idq5C36i4xM8n8VjZkDqWyYbSU

Each transaction is buying tokens from 6 wallets, totally buying with 24 wallets.
You can check successful buying transactions.
Now, again Updated with the random amounts to buy from 24 wallets and seperating dev and funding wallets to pass the security checks.

## Overview

Jito is supporting the bundle service that you can confirm 5 transactions (This is maximum from my experience) at once.

I am doing with 24 wallets, but there is possibility to increase the number of wallets.
So, each swap instruction of Pumpfun has less accounts than Raydium, so we can use Lookuptable more effectively than Raydium.

It provides methods for creating, buying from 24 wallets, and selling tokens when you want.

This is the steps of My bundler.

## 1. Creating wallets to buy tokens from the pool you creating.

## 2. Creating Lookuptable

## 3. Extending Lookuptable and simulations of each transactions to bundle

## 4. Bundle createPool with the token of metadata transaction and 4 transactions buying from 24 wallets.

## 5. Sell tokens at once from 24 wallets using bundle when you want

## 6. Gathering Sol from 24 wallets you bundle buy and sell

## In additional you might mornitor token price all time

# Updated Version

Be careful when you have bundle buy  
Sometimes there is a confirm error because slippage.  
so I updated Version with solving that problem
