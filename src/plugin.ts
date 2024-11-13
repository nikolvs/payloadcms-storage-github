import type { Config, Plugin } from 'payload'
import type {
  Adapter,
  CollectionOptions,
  GeneratedAdapter,
  PluginOptions as GithubStoragePluginOptions,
} from '@payloadcms/plugin-cloud-storage/types'
import type { GithubStorageOptions } from './types.js'

import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import { Octokit } from 'octokit'

import { getGenerateURL } from './generateURL.js'
import { getHandleDelete } from './handleDelete.js'
import { getHandleUpload } from './handleUpload.js'
import { getStaticHandler } from './staticHandler.js'

type GithubStoragePlugin = (githubStorageArgs: GithubStorageOptions) => Plugin

export const githubStorage: GithubStoragePlugin =
  (githubStorageOptions: GithubStorageOptions) =>
  (incomingConfig: Config): Config => {
    if (githubStorageOptions.enabled === false) {
      return incomingConfig
    }

    const adapter = githubStorageInternal(githubStorageOptions)

    // Add adapter to each collection option object
    const collectionsWithAdapter: GithubStoragePluginOptions['collections'] = Object.entries(
      githubStorageOptions.collections,
    ).reduce(
      (acc, [slug, collOptions]) => ({
        ...acc,
        [slug]: {
          ...(collOptions === true ? {} : collOptions),
          adapter,
        },
      }),
      {} as Record<string, CollectionOptions>,
    )

    // Set disableLocalStorage: true for collections specified in the plugin options
    const config = {
      ...incomingConfig,
      collections: (incomingConfig.collections || []).map((collection) => {
        if (!collectionsWithAdapter[collection.slug]) {
          return collection
        }

        return {
          ...collection,
          upload: {
            ...(typeof collection.upload === 'object' ? collection.upload : {}),
            disableLocalStorage: true,
          },
        }
      }),
    }

    return cloudStoragePlugin({
      collections: collectionsWithAdapter,
    })(config)
  }

function githubStorageInternal({
  owner,
  repo,
  options,
  branch = 'main',
}: GithubStorageOptions): Adapter {
  return ({ collection, prefix }): GeneratedAdapter => {
    let storageClient: Octokit | null = null

    const getStorageClient = (): Octokit => {
      if (storageClient) {
        return storageClient
      }

      storageClient = new Octokit(options)
      return storageClient
    }

    return {
      name: 'github',
      generateURL: getGenerateURL({ branch, owner, repo }),
      handleDelete: getHandleDelete({
        getStorageClient,
        owner,
        repo,
        branch,
      }),
      handleUpload: getHandleUpload({
        getStorageClient,
        owner,
        repo,
        branch,
        prefix,
      }),
      staticHandler: getStaticHandler({
        owner,
        repo,
        branch,
        collection,
        getStorageClient,
      }),
    }
  }
}
