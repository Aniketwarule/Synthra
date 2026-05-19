/**
 * @file deploy-config.ts
 * @purpose Deployment configuration for the SynthraVault stateful contract.
 * @dependencies @algorandfoundation/algokit-utils, SynthraVaultClient (generated)
 */
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { SynthraVaultFactory } from '../artifacts/synthra_vault/SynthraVaultClient'

/**
 * Deploy the SynthraVault contract to the configured network.
 *
 * State Schema:
 *   globalInts: 1  (totalCalls)
 *   globalBytes: 1 (owner)
 *   localInts: 1   (userBalance)
 *   localBytes: 0
 *
 * @throws If deployment fails or the deployer account is not funded
 */
export async function deploy() {
  console.log('=== Deploying SynthraVault ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(SynthraVaultFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient, result } = await factory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  // Fund the app account for inner transaction fees and MBR
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
    console.log(`Funded app account ${appClient.appAddress} with 1 ALGO`)
  }

  console.log(
    `SynthraVault deployed: appId=${appClient.appClient.appId}, appAddress=${appClient.appAddress}`,
  )
}
