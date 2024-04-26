require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { Web3 } = require('web3');

if (!process.env.ETH_RPC || !process.env.EVMOS_RPC) {
  console.error("Provider RPC URL is missing in the environment variables.");
  process.exit(1);
}

const starknet = require("starknet");
const { providers: nearProviders } = require("near-api-js");
const { SigningStargateClient } = require('@cosmjs/stargate');
const { AxelarGMPRecoveryAPI, Environment } = require("@axelar-network/axelarjs-sdk");

// Configura i provider per le diverse blockchain
const web3Ethereum = new Web3(process.env.ETH_RPC);
const web3Evmos = new Web3(process.env.EVMOS_RPC);
const providerStarkNet = new starknet.RpcProvider({
  nodeUrl: process.env.STARKNET_RPC,
});
const providerNear = new nearProviders.JsonRpcProvider(process.env.NEAR_RPC);
const evmosCosmosRpc = process.env.EVMOS_COSMOS_RPC;

// Imposta una variabile globale per il contatore
let counter = 0;

// Funzione per leggere gli hash delle transazioni dal file e selezionarne uno casuale
function getRandomTxHash(filePath) {
  const txHashes = fs.readFileSync(filePath, { encoding: 'utf8' }).split('\n').filter(Boolean); // Aggiunto filter(Boolean) per ignorare righe vuote
  const randomIndex = Math.floor(Math.random() * txHashes.length);
  return txHashes[randomIndex];
}

// Funzioni specifiche per ciascuna blockchain
async function getEthereumData() {
  try {
    const blockNumberEthereum = await web3Ethereum.eth.getBlockNumber();
    console.log("Ethereum block number:", blockNumberEthereum);
    counter++;
  } catch (error) {
    console.error('Error retrieving Ethereum data: ' + error);
  }
}

async function getEvmosData() {
  try {
    let blockNumber = await web3Evmos.eth.getBlockNumber();
    console.log('Evmos Cosmos Block Height: ' + blockNumber);
    counter++;
  } catch (error) {
    console.error('Error retrieving Evmos data: ' + error);
  }
}

async function getEvmosCosmosData() {
  try {
    const client = await SigningStargateClient.connect(evmosCosmosRpc);
    const latestBlockHeight = await client.getHeight();
    console.log('Evmos Cosmos Block Height via CosmJS:', latestBlockHeight);
    counter++;
  } catch (error) {
    console.error('Error retrieving Evmos data via CosmJS:', error);
  }
}

async function getStarkNetData() {
  try {
    const blockStarkNet = await providerStarkNet.getBlock("latest");
    console.log("StarkNet block number:", blockStarkNet.block_number);
    counter++;
  } catch (error) {
    console.error('Error retrieving StarkNet data: ' + error);
  }
}

async function getNEARData() {
  try {
    const blockNear = await providerNear.block({ finality: "final" });
    console.log("NEAR block height:", blockNear.header.height);
    counter++;
  } catch (error) {
    console.error('Error retrieving NEAR data: ' + error);
  }
}

const axelarSdk = new AxelarGMPRecoveryAPI({
  axelarRpcUrl: process.env.AXELAR_RPC,
  environment: Environment.MAINNET,
});

// Percorso al file txhash.txt (adattalo in base alla struttura della tua cartella)
const txHashFilePath = path.join(__dirname, 'axelar.txt');

async function queryAxelarTxStatus(txHash) {
  try {
    const result = await axelarSdk.queryTransactionStatus(txHash);
    console.log('Axelar Tx Hash:', txHash);
    console.log("Axelar Tx Status:", result.status);
    counter++;
  } catch (error) {
    console.error("Error querying Axelar Tx Status:", error);
  }
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

async function unifiedOperation() {
  console.log('-----------------------------------');
  console.log('-----------------------------------');
  const timestamp = new Date().toLocaleString();
  console.log(`DATA E ORA: ${timestamp}`);
  console.log('-----------------------------------');
  console.log('-----------------------------------');

  const operations = [
    { func: getEthereumData, name: "Ethereum" },
    { func: getEvmosData, name: "Evmos" },
    { func: getEvmosCosmosData, name: "Evmos Cosmos" },
    { func: getStarkNetData, name: "StarkNet" },
    { func: getNEARData, name: "NEAR" },
    { func: () => queryAxelarTxStatus(getRandomTxHash(txHashFilePath)), name: "Axelar" }
  ];

  let completedOperations = 0;

  operations.forEach(operation => {
    const delay = randomDelay(+process.env.TIMEOUT_MIN, +process.env.TIMEOUT_MAX);
    const seconds = delay / 1000;
    console.log(`${operation.name} waiting ${seconds} seconds before starting...`);
    setTimeout(() => {
      operation.func().then(() => {
        console.log(`${operation.name} completed. Current counter: ${counter}`);
        completedOperations++;
        if (completedOperations === operations.length) {
          console.log("All operations have been completed. Total operations counter:", counter);
          const newDelay = randomDelay(+process.env.TIMEOUT_CICLE_MIN, +process.env.TIMEOUT_CICLE_MAX);
          const newSeconds = newDelay / 1000;
          console.log(`WAITING ${newSeconds} SECONDOS BEFORE STARTING AGAIN ALL OPERATIONS...`);
          setTimeout(unifiedOperation, newDelay);
        }
      }).catch(error => {
        console.error("Error during operation:", error);
      });
    }, delay);
  });
}

// Avvia l'operazione unificata
unifiedOperation();
