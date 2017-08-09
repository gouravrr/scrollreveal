import style from '../functions/style'
import initialize from '../functions/initialize'
import { Sequence } from '../functions/sequence'

import { getNode, getNodes, logger } from '../../utils/core'
import { deepAssign, each, nextUniqueId } from '../../utils/generic'
import { isMobile } from '../../utils/browser'


export default function reveal (target, options, interval, sync) {

	const containers = this.store.containers

	/**
	 * The reveal method has an optional 2nd parameter,
	 * so here we just shuffle things around to accept
	 * the interval being passed as the 2nd argument.
	 */
	if (typeof options === 'number') {
		interval = parseInt(options)
		options = {}
	} else {
		interval = parseInt(interval)
		options = options || {}
	}

	/**
	 * Now let’s attempt to construct a new sequence.
	 */
	let sequence
	try {
		sequence = new Sequence(interval) || null
	} catch (e) {
		return logger.call(this, 'Reveal failed.', e.stack)
	}

	let config
	let container
	let nodes
	try {
		config = deepAssign({}, this.defaults, options)
		container = getNode(config.container)
		if (!container) {
			throw new Error('Invalid container.')
		}
		nodes = getNodes(target, container)
		if (!nodes) {
			throw new Error('Nothing to animate.')
		}
	} catch (e) {
		return logger.call(this, 'Reveal failed.', e.stack)
	}

	/**
	 * Verify our platform matches our platform configuration.
	 */
	if (!config.mobile && isMobile() || !config.desktop && !isMobile()) {
		return logger.call(this, 'Reveal aborted.', 'This platform has been disabled.')
	}

	let containerId
	{
		each(containers, storedContainer => {
			if (!containerId && storedContainer.node === container) {
				containerId = storedContainer.id
			}
		})
		if (isNaN(containerId)) {
			containerId = nextUniqueId()
		}
	}

	/**
	 * Begin element set-up...
	 */
	try {
		const elements = nodes.map(node => {
			const element = {}
			const existingId = node.getAttribute('data-sr-id')

			if (existingId) {
				deepAssign(element, this.store.elements[existingId])

				/**
				 * In order to prevent previously generated styles
				 * from throwing off the new styles, the style tag
				 * has to be reverted to it's pre-reveal state.
				 */
				element.node.setAttribute('style', element.styles.inline)

			} else {
				element.id = nextUniqueId()
				element.node = node
				element.seen = false
				element.revealed = false
				element.visible = false
			}

			element.config = config
			element.containerId = containerId
			element.styles = style(element)

			if (sequence) {
				element.sequence = {
					id: sequence.id,
					index: sequence.members.length,
				}
				sequence.members.push(element.id)
			}

			return element
		})

		/**
		* Modifying the DOM via setAttribute needs to be handled
		* separately from reading computed styles in the map above
		* for the browser to batch DOM changes (limiting reflows)
		*/
		each(elements, element => {
			this.store.elements[element.id] = element
			element.node.setAttribute('data-sr-id', element.id)
		})

	} catch (e) {
		return logger.call(this, 'Reveal failed.', e.stack)
	}

	/**
	 * Now that element set-up is complete...
	 *
	 * Let’s commit the current container and any
	 * sequence data we have to the store.
	 */
	{
		containers[containerId] = containers[containerId] || {
			id: containerId,
			node: container,
		}
		if (sequence) {
			this.store.sequences[sequence.id] = sequence
		}
	}

	/**
	* If reveal wasn't invoked by sync, we want to
	* make sure to add this call to the history.
	*/
	if (!sync) {
		this.store.history.push({ target, options, interval })

		/**
		* Push initialization to the event queue, giving
		* multiple reveal calls time to be interpretted.
		*/
		if (this.initTimeout) {
			window.clearTimeout(this.initTimeout)
		}
		this.initTimeout = window.setTimeout(initialize.bind(this), 0)
	}
}
