require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const bodyParser = require('body-parser');
const TextData = require('./models/textData');
const { Blob } = require('buffer');
const { Web3 } = require('web3');

const app = express();

const WEB3_PROVIDER_URL = process.env.WEB3_PROVIDER_URL;

const web3 = new Web3(WEB3_PROVIDER_URL);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Atlas connected'))
  .catch(err => console.error('MongoDB Atlas connection error:', err));

app.use(bodyParser.json());

async function uploadToIPFS(data) {
  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;

  const blob = new Blob([data], { type: 'text/plain' });

  const formData = new FormData();
  formData.append('file', blob, {
    filepath: 'data.txt'
  });

  const response = await axios.post(url, formData, {
    maxBodyLength: 'Infinity',
    headers: {
        'pinata_api_key': process.env.PINATA_API_KEY,
        'pinata_secret_api_key': process.env.PINATA_API_SECRET
    }
  });

  return response.data.IpfsHash;
}

app.post('/store', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text data is required' });
    }

    const ipfsHash = await uploadToIPFS(text);

    const textData = new TextData({ ipfsHash });
    await textData.save();

    res.status(201).json({ ipfsHash });
  } catch (error) {
    console.error('Error storing data:', error);
    res.status(500).json({ error: 'Failed to store data' });
  }
});

app.get('/retrieve/:ipfsHash', async (req, res) => {
  try {
    const { ipfsHash } = req.params;

    const textData = await TextData.findOne({ ipfsHash });
    if (!textData) {
      return res.status(404).json({ error: 'Data not found' });
    }

    const response = await axios.get(`${process.env.PINATA_GATEWAY}${ipfsHash}`, {
      responseType: 'text', 
    });

    res.status(200).json({ text: response.data });
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});


app.get('/balance/:tokenAddress/:walletAddress', async (req, res) => {
	try {
	  const { tokenAddress, walletAddress } = req.params;
  
	  if (!web3.utils.isAddress(tokenAddress)) {
		return res.status(400).json({ error: 'Invalid token address' });
	  }
	  if (!web3.utils.isAddress(walletAddress)) {
		return res.status(400).json({ error: 'Invalid wallet address' });
	  }
  
	  const minABI = [
		{
		  constant: true,
		  inputs: [{ name: '_owner', type: 'address' }],
		  name: 'balanceOf',
		  outputs: [{ name: 'balance', type: 'uint256' }],
		  type: 'function',
		},
		{
		  constant: true,
		  inputs: [],
		  name: 'decimals',
		  outputs: [{ name: '', type: 'uint8' }],
		  type: 'function',
		},
	  ];
  
	  const contract = new web3.eth.Contract(minABI, tokenAddress);
	  const balance = await contract.methods.balanceOf(walletAddress).call();
	  const decimals = await contract.methods.decimals().call();
  
	  const adjustedBalance = parseFloat(balance.toString()) / Math.pow(10, decimals.toString());
  
	  res.status(200).json({ balance: adjustedBalance });
  
	} catch (error) {
	  console.error('Error fetching token balance:', error);
	  res.status(500).json({ error: 'Failed to fetch token balance' });
	}
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));