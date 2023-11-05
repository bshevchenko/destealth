import { ethers } from 'hardhat'
import { ec as EC } from 'elliptic'
import BN from "bn.js"
const ec = new EC('secp256k1')

const ecG = ec.curve.point(
    '79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798',
    '483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8'
)

export function getStealthAddress(pubKey: string, secret: string) {
    const secretToNumber = ethers.keccak256(ethers.toUtf8Bytes(secret))
    // Remove "0x" prefix for elliptic library
    const publicKeyX = pubKey.slice(4, 68)
    const publicKeyY = pubKey.slice(68)
    const publicKey = ec.curve.point(publicKeyX, publicKeyY)

    const sharedSecretPoint = publicKey.mul(secretToNumber.slice(2))
    const sharedSecretX = ethers.toBeHex(sharedSecretPoint.x.toString())
    const sharedSecretY = ethers.toBeHex(sharedSecretPoint.y.toString())
    const sharedSecretToNumber = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256'],
        [sharedSecretX, sharedSecretY]
    )
    const sharedSecretGPoint = ecG.mul(sharedSecretToNumber.slice(2))

    const stealthPublicKey = publicKey.add(sharedSecretGPoint)
    const stealthPublicX = ethers.toBeHex(stealthPublicKey.x.toString())
    const stealthPublicY = ethers.toBeHex(stealthPublicKey.y.toString())
    const stealthPublicKeyToNumber = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256'],
        [stealthPublicX, stealthPublicY]
    )

    const newStealthAddress = ethers.getAddress('0x' + stealthPublicKeyToNumber.slice(-40))

    const sharedSecret_ = ecG.mul(secretToNumber.slice(2))
    const sharedSecret_X = ethers.toBeHex(sharedSecret_.x.toString())
    const sharedSecret_Y = ethers.toBeHex(sharedSecret_.y.toString())

    return [newStealthAddress, sharedSecret_X + sharedSecret_Y.slice(2)]
}

/**
 * @notice Gets stealth private key
 * from your private key and shared secret
 * more info: https://vitalik.ca/general/2023/01/20/stealth.html
 */
export function getStealthPrivateKey(
    privateKey: string,
    sharedSecret: string,
) {
    // Biggest number allowed
    // https://ethereum.stackexchange.com/questions/10055/is-each-ethereum-address-shared-by-theoretically-2-96-private-keys
    const modulo = new BN('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141', 'hex')

    // Remove "0x" prefix for elliptic library  
    let sharedSecretPointX = sharedSecret.slice(2, 66)
    let sharedSecretPointY = sharedSecret.slice(66)
    let sharedSecretPoint = ec.curve.point(sharedSecretPointX, sharedSecretPointY)

    sharedSecretPoint = sharedSecretPoint.mul(privateKey.slice(2))
    sharedSecretPointX = '0x' + sharedSecretPoint.x.toString('hex')
    sharedSecretPointY = '0x' + sharedSecretPoint.y.toString('hex')
    const sharedSecretPointToNumber = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256'],
        [sharedSecretPointX, sharedSecretPointY]
    )

    const sharedSecretBigInt = new BN(sharedSecretPointToNumber.substring(2), 'hex')
    const privateKeyBigInt = new BN(privateKey.substring(2), 'hex')
    const stealthPrivateKey = (privateKeyBigInt.add(sharedSecretBigInt)).mod(modulo) // can overflow uint256
    const stealthPrivateKeyHex = stealthPrivateKey.toString('hex')
    const wallet = new ethers.Wallet(stealthPrivateKeyHex)
    return "0x" + stealthPrivateKeyHex
}
