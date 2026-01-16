import { useState } from "react";
import { BrowserProvider, Contract, parseEther, formatEther } from "ethers";
import "./App.css";

const contractAddress = "0xea175054c2380f819f3a8a4fe78e10cc0e1f4c3a";

const abi = [
  "function joinGroup() public",
  "function contribute() public payable",
  "function selectBorrower(address)",
  "function releaseFund() public",
  "function totalPool() public view returns(uint)"
];

function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [borrower, setBorrower] = useState("");
  const [pool, setPool] = useState("0");

  async function connectWallet() {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setAccount(address);
    setContract(new Contract(contractAddress, abi, signer));
  }

  async function joinGroup() {
    const tx = await contract.joinGroup();
    await tx.wait();
    alert("Joined community successfully");
  }

  async function contribute() {
    const tx = await contract.contribute({ value: parseEther("0.01") });
    await tx.wait();
    alert("Contribution sent");
  }

  async function selectBorrower() {
    const tx = await contract.selectBorrower(borrower);
    await tx.wait();
    alert("Borrower selected");
  }

  async function releaseFund() {
    const tx = await contract.releaseFund();
    await tx.wait();
    alert("Fund released to borrower");
  }

  async function checkPool() {
    const bal = await contract.totalPool();
    setPool(formatEther(bal));
  }

  return (
    <div className="app-container">
      <div className="dashboard">
        <h1>Community Savings DApp</h1>

        <button onClick={connectWallet}>Connect Wallet</button>
        {account && <div className="wallet">Connected: {account}</div>}

        <div className="section">
          <button onClick={joinGroup}>Join Group</button>
          <button onClick={contribute}>Contribute 0.01 ETH</button>
        </div>

        <div className="section">
          <input
            placeholder="Borrower Wallet Address"
            value={borrower}
            onChange={(e) => setBorrower(e.target.value)}
          />
          <button onClick={selectBorrower}>Select Borrower</button>
          <button onClick={releaseFund}>Release Fund</button>
        </div>

        <div className="section">
          <button onClick={checkPool}>Check Pool Balance</button>
          <div className="pool">Pool Balance: {pool} ETH</div>
        </div>
      </div>
    </div>
  );
}

export default App;
