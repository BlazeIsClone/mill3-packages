/**
 * @mill3-packages/barba-scripts
 * <br><br>
 * ## Barba Scripts.
 *
 * - Add external scripts from head
 * - Manage inlined scripts in next.container
 *
 * @module barba-scripts
 * @preferred
 */

import { version } from '../package.json';

export const SCRIPTS_SELECTOR = 'script[type="text/javascript"]';
export const INLINE_SCRIPTS_SELECTOR = 'script:not([type="text/html"])';

export class Scripts {

  constructor() {
    this.name = '@barba/scripts';
    this.version = version;
    this.barba;
    this.logger;

    this._parser;
    this._source;
  }

  /**
   * Plugin installation.
   */
  install(barba) {
    this.logger = new barba.Logger(this.name);
    this.logger.info(this.version);

    this.barba = barba;

    this._parser = new DOMParser();
  }

  /**
   * Plugin installation.
   */
  init() {

    // Register hook for CSS classes
    this.barba.hooks.beforeEnter(this._beforeEnter, this);
    this.barba.hooks.afterEnter(this._afterEnter, this);
  }

  /**
   * Add scripts (external source or inlined) to document <head>.
   */
  add(js) {

    // if scripts is empty, do nothing
    if (!js || js.length === 0) {
      return Promise.resolve();
    }

    // Collect all scripts in head
    const head = document.querySelector('head');
    const currentScripts = [...head.querySelectorAll(SCRIPTS_SELECTOR)].map(script => this._getScriptNamespace(script));
    const newScripts = [];


    // for each script found in head
    js.forEach(script => {
      // if this script is already in head, do nothing
      if (currentScripts.includes(this._getScriptNamespace(script))) {
        return;
      }

      // create new script tag
      const tag = document.createElement('script');

      // copy all attributes from script
      this._copyAttributes(tag, script);

      // if script has inlined text, copy it
      if (script.text) {
        tag.appendChild(document.createTextNode(script.text));
      }

      // push script
      newScripts.push(tag);
    });

    // synchronously load each script
    if (newScripts.length > 0) {
      return newScripts.reduce((promise, script) => {
        return promise.then(() => (script.text ? this._inlineScript(script, head) : this._loadScript(script, head)));
      }, Promise.resolve());
    }

    return Promise.resolve();
  }

  /**
   * Run inlined scripts.
   * Will log error if script has no inlined code.
   */
  run(js) {
    // if scripts is empty, do nothing
    if (!js || js.length === 0) {
      return Promise.resolve();
    }

    const newScripts = [];

    // for each scripts
    js.forEach(script => {
      // create new script tag
      const tag = document.createElement('script');

      // copy all attributes from script
      this._copyAttributes(tag, script);

      // if script has inlined text, copy it
      if (script.text) {
        tag.appendChild(document.createTextNode(script.text));
      } else {
        this.logger.error(`Unable to execute this script because it does not contains inlined code.`, script);
        return;
      }

      // enqueue script
      newScripts.push({script: tag, target: script.parentNode});

      // remove script from DOM to avoid pollution
      script.parentNode.removeChild(script);
    });

    // synchronously run each script
    return newScripts.reduce((promise, {script, target}) => {
      return promise.then(() => this._inlineScript(script, target));
    }, Promise.resolve());
  }

  /**
   * Load external script and append it to document.
   */
  _loadScript(script, target) {
    return new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;

      target.appendChild(script);
    });
  }

  /**
   * Append script to document and execute it.
   */
  _inlineScript(script, target) {
    return new Promise(resolve => {
      target.appendChild(script);
      resolve();
    });
  }

  /**
   * Get script namespace (kind of UDID).
   */
  _getScriptNamespace(script) {
    return script.src ? script.src : script.text;
  }

  /**
   * Copy all attributes from source to target element.
   */
  _copyAttributes(target, source) {
    if (source.hasAttributes()) {
      const attrs = source.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        target.setAttribute(attrs[i].name, attrs[i].value);
      }
    }
  }

  /**
   * `beforeEnter` hook.
   */
  _beforeEnter(data) {

    // parse html return from Barba
    this._source = this._parser.parseFromString(data.next.html, 'text/html');

    // Find head + scripts returned from Barba
    const head = this._source.querySelector('head');
    const js = [...head.querySelectorAll(SCRIPTS_SELECTOR)];

    // Inject new external scripts
    return this.add(js);
  }

  /**
   * `afterEnter` hook.
   */
  _afterEnter(data) {
    // Find inlined scripts in source and eval() any text values as JS scripts
    // This is for useful for WP plugins like Gravity Forms who inject inline scripts
    const js = [...data.next.container.querySelectorAll(INLINE_SCRIPTS_SELECTOR)];

    // Run inlined scripts
    return this.run(js);
  }
}

const scripts = new Scripts();

export default scripts;
