import { SendMessageToBackground } from '../../types'
import Renderer from '../platforms/renderer'

const $ = (selector: string) => document.querySelector(selector)
const $$ = (selector: string) => document.querySelectorAll(selector)

function getLocationPath() {
  return location.protocol + '//' + location.host + location.pathname
}

export interface RendererParams {
  getContainer: () => Element | null
  // getPositionContainer?: () => Element | null
  // getScrollLeft: () => number
  getFontDOM: () => Element | null
  // getHighlightColor: () => string
  getLineWidthAndHeight: () => {
    width: number
    height: number
  }
  getPadding: () => {
    left: number
    top: number
  }
  getCodeUrl: () => string
  getFileName: () => string
  getEditorConfigUrl?: () => string
  // TODO: This is pretty tricky for making GitLab and Bitbucket work
  extraBeforeRender?: () => void
}

const GitHubRenderer: RendererParams = {
  getContainer: () => $('.blob-wrapper'), // $('.blob-wrapper') is not OK because of scroll x
  // getContainer: () => $('.file'),
  // getScrollLeft: () => ($('.blob-wrapper') as HTMLElement).scrollLeft,
  // getHighlightColor: () => '#fffbdd',
  getFontDOM: () => $('#LC1'),
  getLineWidthAndHeight: () => ($('#LC1') as HTMLElement).getBoundingClientRect(),
  getPadding: () => ({
    left: 60,
    top: 0,
  }),
  getCodeUrl: () => getLocationPath().replace('/blob/', '/raw/'),
  getFileName: getLocationPath,
  getEditorConfigUrl() {
    return this.getCodeUrl().replace(/(^.*?\/raw\/.*?\/).*$/, '$1') + '.editorconfig'
  },
}

function GithubGistRendererFactory(wrapper: HTMLElement): RendererParams {
  return {
    getContainer: () => wrapper.querySelector('.blob-wrapper table'), // $('.blob-wrapper') is not OK because of scroll x
    getFontDOM: () => wrapper.querySelector('.blob-wrapper span[class]'),
    getLineWidthAndHeight: () => ({ width: 918, height: 20 }),
    getPadding: () => ({
      left: 60,
      top: 0,
    }),
    getCodeUrl: () => (wrapper.querySelector('.file-actions a') as HTMLAnchorElement).href,
    getFileName: () => (wrapper.querySelector('.file-actions a') as HTMLAnchorElement).href,
  }
}

const BitbucketRenderer: RendererParams = {
  getContainer: () => $('.file-source .code'),
  getFontDOM: () => $('.file-source .code pre'),
  getLineWidthAndHeight: () => ({
    width: (<HTMLElement>$('.file-source')).offsetWidth - 43,
    height: 16,
  }),
  getPadding: () => ({
    left: 0,
    top: 0,
  }),
  getCodeUrl: () => getLocationPath().replace('/src/', '/raw/'),
  getFileName: getLocationPath,
  extraBeforeRender: () => (($('.file-source .code pre') as HTMLElement).style.position = 'relative'),
}

// This GitLab is for old version
// TODO: New version use dynamic loading
const GitLabRenderer: RendererParams = {
  getContainer: () => $('.blob-content .code'),
  getFontDOM: () => $('#LC1'),
  getLineWidthAndHeight: () => ($('#LC1') as HTMLElement).getBoundingClientRect(),
  getPadding: () => ({
    left: 10,
    top: 0,
  }),
  getCodeUrl: () => getLocationPath().replace('/blob/', '/raw/'),
  getFileName: getLocationPath,
  extraBeforeRender: () => (($('.blob-content .code code') as HTMLElement).style.position = 'relative'),
}

export default abstract class Adapter {
  abstract getSendMessage(): SendMessageToBackground

  constructor() {
    const sendMessage = this.getSendMessage()

    // GitHub Gist
    if (/gist\.github\.com/.test(location.href)) {
      const list = $$('.file-actions a')
      ;[].forEach.call($$('.js-task-list-container'), (wrapper: HTMLElement) => {
        new Renderer(sendMessage, GithubGistRendererFactory(wrapper))
      })
      return
    }

    // TODO: Dynamic import
    // May be deployed at private domain, URL
    // So use DOM selector
    const githubPjaxContainer = $('#js-repo-pjax-container')
    if (githubPjaxContainer) {
      new MutationObserver(mutations => {
        // console.log(mutations)
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length) {
            if (GitHubRenderer.getContainer()) {
              new Renderer(sendMessage, GitHubRenderer)
            }
          }
        })
      }).observe(githubPjaxContainer, {
        attributes: true,
        childList: true,
        characterData: true,
      })
    }

    if (GitHubRenderer.getContainer()) {
      new Renderer(sendMessage, GitHubRenderer)
      return
    }

    if (GitLabRenderer.getContainer()) {
      new Renderer(sendMessage, GitLabRenderer)
      return
    }

    const bitbucketPjaxContainer = $('#source-container')
    if (bitbucketPjaxContainer) {
      new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length) {
            if (BitbucketRenderer.getContainer()) {
              new Renderer(sendMessage, BitbucketRenderer)
            }
          }
        })
      }).observe(bitbucketPjaxContainer, {
        attributes: true,
        childList: true,
        characterData: true,
      })
    }

    if (BitbucketRenderer.getContainer()) {
      new Renderer(sendMessage, BitbucketRenderer)
      return
    }
  }
}