import { useState, useEffect } from "react";
import { BrowserProvider, Contract, parseEther, formatEther } from "ethers";
import "./App.css";

const contractAddress = "0x71853fa575b4eeb88fa473d14bf3f49ca0065180";

const abi = [
  "function joinGroup() payable",
  "function selectBorrower(address)",
  "function releaseFunds()",
  "function payEMI() payable",
  "function withdrawProfit()",
  "function getEMI() view returns(uint)",
  "function getPoolBalance() view returns(uint)",
  "function getMembers() view returns(address[])",
  "function borrower() view returns(address)",
  "function remainingMonths() view returns(uint)"
];

export default function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [tab, setTab] = useState("overview");
  const [borrower, setBorrower] = useState("");
  const [emi, setEmi] = useState("");
  const [pool, setPool] = useState("");
  const [members, setMembers] = useState([]);
  const [monthsLeft, setMonthsLeft] = useState("");

  // Mobile MetaMask auto open
  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && !window.ethereum) {
      window.location.href = "https://metamask.app.link/dapp/shivam11051.github.io/community-dapp";
    }
  }, []);

  async function connectWallet() {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setAccount(address);
    setContract(new Contract(contractAddress, abi, signer));
  }

  async function joinGroup() {
    const tx = await contract.joinGroup({ value: parseEther("0.01") });
    await tx.wait();
    alert("Joined Group");
    loadOverview();
  }

  async function selectBorrowerFunc() {
    const tx = await contract.selectBorrower(borrower);
    await tx.wait();
    alert("Borrower Selected");
  }

  async function releaseFunds() {
    const tx = await contract.releaseFunds();
    await tx.wait();
    alert("Loan Released");
  }

  async function payEMI() {
    const amount = await contract.getEMI();
    const tx = await contract.payEMI({ value: amount });
    await tx.wait();
    alert("EMI Paid");
    loadEMI();
  }

  async function withdrawProfit() {
    const tx = await contract.withdrawProfit();
    await tx.wait();
    alert("Profit Withdrawn");
    loadProfit();
  }

  async function loadOverview() {
    const m = await contract.getMembers();
    setMembers(m);
    const p = await contract.getPoolBalance();
    setPool(formatEther(p));
  }

  async function loadEMI() {
    const e = await contract.getEMI();
    setEmi(formatEther(e));
    const r = await contract.remainingMonths();
    setMonthsLeft(r.toString());
  }

  async function loadProfit() {
    const p = await contract.getPoolBalance();
    setPool(formatEther(p));
  }

  return (
    <div className="app">
      <div className="glass">
        <div className="topbar">
          <div className="logo">BlockChit</div>
          <button onClick={connectWallet}>Connect Wallet</button>
        </div>
        <div className="wallet">{account || "Not Connected"}</div>

        <div className="tabs">
          <button className={tab==="overview"?"active":""} onClick={()=>{setTab("overview"); loadOverview();}}>Overview</button>
          <button className={tab==="emi"?"active":""} onClick={()=>{setTab("emi"); loadEMI();}}>EMI</button>
          <button className={tab==="profit"?"active":""} onClick={()=>{setTab("profit"); loadProfit();}}>Profit</button>
        </div>

        {tab === "overview" && (
          <div className="panel">
            <h3>Group Status</h3>
            <p>Members Joined: {members.length}/3</p>
            <p>Pool Balance: {pool} ETH</p>
            <button onClick={joinGroup}>Join Group (0.01 ETH)</button>

            <h3>Select Borrower</h3>
            <input placeholder="Borrower Address" value={borrower}
              onChange={(e)=>setBorrower(e.target.value)} />
            <button onClick={selectBorrowerFunc}>Confirm Borrower</button>
            <button onClick={releaseFunds}>Release Loan</button>
          </div>
        )}

        {tab === "emi" && (
          <div className="panel">
            <h3>EMI Dashboard</h3>
            <p>Monthly EMI: {emi} ETH</p>
            <p>Remaining Months: {monthsLeft}/12</p>
            <div className="progress">
              <div className="bar" style={{width: `${((12-monthsLeft)/12)*100}%`}}></div>
            </div>
            <button onClick={payEMI}>Pay EMI</button>
          </div>
        )}

        {tab === "profit" && (
          <div className="panel">
            <h3>Profit Pool</h3>
            <p>Total Pool Balance: {pool} ETH</p>
            <p>Your Share (after completion): {pool/3} ETH</p>
            <button onClick={withdrawProfit}>Withdraw Profit</button>
          </div>
        )}
      </div>
    </div>
  );
}
