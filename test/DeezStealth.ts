import { expect } from "chai"
import { ethers } from "hardhat"
import { DeezStealth, MockERC20 } from "../typechain-types"
import { config } from "hardhat"
import { HardhatNetworkHDAccountsConfig } from "hardhat/types/config"
import { HDNodeWallet } from "ethers"
import { getStealthAddress, getStealthPrivateKey } from "../utils"

const accounts: HardhatNetworkHDAccountsConfig = config.networks.hardhat.accounts
const wallet: HDNodeWallet = ethers.Wallet.fromPhrase(accounts.mnemonic, ethers.provider)
const wallets: HDNodeWallet[] = []
const walletsNum = 3;
for (let i = 0; i < walletsNum; i++) {
  wallets.push(
    wallet.derivePath(accounts.path + `/${i}`)
  )
}

console.log(wallets[0].address, wallets[0].signingKey.publicKey, wallets[0].signingKey.privateKey)
console.log(wallets[1].address, wallets[1].signingKey.publicKey, wallets[1].signingKey.privateKey)
console.log(wallets[2].address, wallets[2].signingKey.publicKey, wallets[2].signingKey.privateKey)

describe("DeezStealth", () => {

  let destealth: DeezStealth
  let receivers: string[]

  const pubKey = wallets[0].signingKey.publicKey

  let token0: MockERC20
  let token1: MockERC20

  before(async () => {
    const [a] = await ethers.getSigners()
    for (let i = 0; i < walletsNum; i++) {
      await a.sendTransaction({
        to: wallets[i].address,
        value: ethers.parseEther("10")
      })
    }
    const MockToken = await ethers.getContractFactory("MockERC20")
    token0 = await MockToken.connect(wallets[0]).deploy("Token0", "T0", 18, ethers.parseEther("100"))
    token1 = await MockToken.connect(wallets[0]).deploy("Token1", "T1", 18, ethers.parseEther("100"))
  })

  it("Should deploy and set public key", async () => {
    const DeezStealth = await ethers.getContractFactory("DeezStealth")
    destealth = await DeezStealth.connect(wallets[0]).deploy()
    await destealth.setPubKey(pubKey)
    expect(await destealth.pubKey(wallets[0].address)).to.equal(pubKey)
  })

  // it("Should not set public key second time", async () => {
  //   try {
  //     await destealth.setPubKey(pubKey);
  //   } catch (e: any) {
  //     expect(e.message).to.include("PubKeyProvided")
  //     return
  //   }
  //   expect(true).to.equal(false)
  // })

  it("Should remove public key", async () => {
    await destealth.removePubKey()
    expect(await destealth.pubKey(wallets[0].address)).to.equal("0x")
  })

  it("Should get public keys", async () => {
    await destealth.setPubKey(pubKey)
    await destealth.connect(wallets[1]).setPubKey(wallets[1].signingKey.publicKey)
    await destealth.connect(wallets[2]).setPubKey(wallets[2].signingKey.publicKey)

    const pubKeys = await destealth.getPubKeys([
      wallets[0].address,
      wallets[1].address,
      wallets[2].address
    ])

    expect(pubKeys[0]).to.equal(pubKey)
    expect(pubKeys[1]).to.equal(wallets[1].signingKey.publicKey)
    expect(pubKeys[2]).to.equal(wallets[2].signingKey.publicKey)

    // TODO What are the gas limits of this function? How many keys it can return? Bito says 500...
    // TODO ...If the Linea network has a block gas limit of 10 million gas, but it is actually 61 million, so...
    // TODO ..answer is probably like 3000
  })

  it("Should distribute ETH", async () => {
    receivers = [
      wallets[1].address,
      wallets[2].address
    ]
    const balancesBefore = [
      await ethers.provider.getBalance(wallets[1].address),
      await ethers.provider.getBalance(wallets[2].address),
    ]
    await destealth.distribute(
      receivers,
      '0x0000000000000000000000000000000000000000',
      [ethers.parseEther("0.01")],
      [],
      {
        value: ethers.parseEther("0.02")
      }
    )
    const balancesAfter = [
      await ethers.provider.getBalance(wallets[1].address),
      await ethers.provider.getBalance(wallets[2].address),
    ]
    expect(balancesAfter[0] - balancesBefore[0]).to.equal(ethers.parseEther("0.01"))
    expect(balancesAfter[1] - balancesBefore[1]).to.equal(ethers.parseEther("0.01"))
  })

  it("Should distribute ERC20 token & GasPass ETH", async () => {
    const balancesBefore = [
      await ethers.provider.getBalance(wallets[1].address),
      await ethers.provider.getBalance(wallets[2].address),
    ]
    const tokenBalancesBefore = [
      await token0.balanceOf(wallets[1].address),
      await token0.balanceOf(wallets[2].address)
    ]
    await token0.approve(await destealth.getAddress(), ethers.parseEther("0.02"))
    await destealth.distribute(
      receivers,
      await token0.getAddress(),
      [ethers.parseEther("0.01")],
      [ethers.parseEther("0.0023")],
      {
        value: ethers.parseEther("0.0046")
      }
    )
    const balancesAfter = [
      await ethers.provider.getBalance(wallets[1].address),
      await ethers.provider.getBalance(wallets[2].address),
    ]
    const tokenBalancesAfter = [
      await token0.balanceOf(wallets[1].address),
      await token0.balanceOf(wallets[2].address)
    ]
    expect(balancesAfter[0] - balancesBefore[0]).to.equal(ethers.parseEther("0.0023"))
    expect(balancesAfter[1] - balancesBefore[1]).to.equal(ethers.parseEther("0.0023"))
    expect(tokenBalancesAfter[0] - tokenBalancesBefore[0]).to.equal(ethers.parseEther("0.01"))
    expect(tokenBalancesAfter[1] - tokenBalancesBefore[1]).to.equal(ethers.parseEther("0.01"))
  })

  it("Should distribute ERC20 token & different GasPass Amounts", async () => {
    const balancesBefore = [
      await ethers.provider.getBalance(wallets[1].address),
      await ethers.provider.getBalance(wallets[2].address),
    ]
    const tokenBalancesBefore = [
      await token0.balanceOf(wallets[2].address),
    ]
    await token0.approve(await destealth.getAddress(), ethers.parseEther("0.02"))
    await destealth.distribute(
      receivers,
      await token0.getAddress(),
      [
        ethers.parseEther("0.01"), // Token 0 amount for receiver 1
        ethers.parseEther("0.01"), // Token 1 amount for receiver 2
      ],
      [
        ethers.parseEther("0.0023"), // GasPass amount for receiver 0
        ethers.parseEther("0.0045"),  // GasPass amount for receiver 1
      ],
      {
        value: ethers.parseEther("0.0168")
      }
    )
    const balancesAfter = [
      await ethers.provider.getBalance(wallets[1].address),
      await ethers.provider.getBalance(wallets[2].address),
    ]
    const tokenBalancesAfter = [
      await token0.balanceOf(wallets[2].address),
    ]
    expect(balancesAfter[0] - balancesBefore[0]).to.equal(ethers.parseEther("0.0023"), "balances0")
    expect(balancesAfter[1] - balancesBefore[1]).to.equal(ethers.parseEther("0.0045"), "balances1")
    expect(tokenBalancesAfter[0] - tokenBalancesBefore[0]).to.equal(ethers.parseEther("0.01"), "tokenBalances0")
    // expect(tokenBalancesAfter[1] - tokenBalancesBefore[1]).to.equal(ethers.parseEther("0.01"), "tokenBalances1")
  })

  it("Should not accept ETH directly", async () => {
    const [a] = await ethers.getSigners()
    try {
      await a.sendTransaction({
        to: await destealth.getAddress(),
        value: ethers.parseEther("1")
      })
    } catch (e: any) {
      expect(e.message).to.include("receive function")
      return
    }
    expect(true).to.equal(false)
  })

  describe("Crypto", () => {
    it("Should generate stealth address and stealth private key", async () => {
      const secret = "abc"
      const [stealthAddress, sharedSecret] = getStealthAddress(pubKey, secret)

      const stealthPrivateKey = getStealthPrivateKey(wallets[0].signingKey.privateKey, sharedSecret)
      const stealthWallet = new ethers.Wallet(stealthPrivateKey)
      
      expect(stealthWallet.address).to.equal(stealthAddress)
    })

    const num = 100
    it(`Should generate ${num} stealth addresses`, async () => {
      const secret = "abc"
      let i = 0
      while (i < num) {
        getStealthAddress(pubKey, secret)
        i++
      }
      expect(i).to.equal(num)
    })
  })
})
