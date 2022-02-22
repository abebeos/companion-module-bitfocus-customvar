const instance_skel = require('../../instance_skel')
const jp = require('jsonpath')

// early draft, not fully functional
//TODO: attempt to access the internal variable choices from the bitfocus-companion module
//TDOD: rewrite to classes (no prototype)
//TODO: replace system.emit and system.on calls with normal method calls
//TODO: correct the package.json file (authors, links etc.)

function instance(system, id, config) {
	let self = this

	self.system = system
	

	instance_skel.apply(this, arguments)		// super-constructor
	self.init()
	return self
}

instance.prototype.init = function () {
	let self = this

	self.init_actions()
	self.status(self.STATE_OK)
}

// Return config fields for web config
instance.prototype.config_fields = function () {
	let self = this

	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module exposes internal functions of companion and does not have any configuration options',
		},
	]
}


// When module gets deleted
instance.prototype.destroy = function () {
	let self = this
}

instance.prototype.init_actions = function () {
	let self = this

	self.FIELD_JSON_DATA_VARIABLE = {
		type: 'custom-variable',
		label: 'JSON Result Data Variable',
		id: 'jsonResultDataVariable',
	}

	self.FIELD_JSON_PATH = {
		type: 'textwithvariables',
		label: 'Path (like $.age)',
		id: 'jsonPath',
		default: '',
	}

	self.FIELD_TARGET_VARIABLE = {
		type: 'custom-variable',
		label: 'Target Variable',
		id: 'targetVariable',
	}

	self.FIELD_CUSTOM_VARIABLE = {
		type: 'custom-variable',
		label: 'Custom variable',
		id: 'name',
	}

	actions = {
		custom_variable_set_value: {
			label: 'Set value',
			options: [
				self.FIELD_CUSTOM_VARIABLE,
				{
					type: 'textinput',
					label: 'Value',
					id: 'value',
					default: '',
				},
			],
		},
		custom_variable_set_expression: {
			label: 'Set expression',
			options: [
				self.FIELD_CUSTOM_VARIABLE,
				{
					type: 'textwithvariables',
					label: 'Expression',
					id: 'expression',
					default: '',
				},
			],
		},
		custom_variable_store_variable: {
			label: 'Set from another variable',
			options: [
				self.FIELD_CUSTOM_VARIABLE,
				{
					type: 'dropdown',
					id: 'variable',
					label: 'Variable to store value from',
					tooltip: 'What variable to store in the custom variable?',
					default: 'internal:time_hms',
					choices: self.CHOICES_VARIABLES,
				},
			],
		},
		custom_variable_set_via_jsonpath: {
			label: 'Set from a stored JSONresult via a JSONpath expression',
			options: [self.FIELD_JSON_DATA_VARIABLE, self.FIELD_JSON_PATH, self.FIELD_TARGET_VARIABLE],
		},
	}

	self.system.emit('instance_actions', self.id, actions)
}

instance.prototype.action = function (action, extras) {
	let self = this
	let opt = action.options

	//TODO: consider moving this code to lib/variable.js, where the other custom-var code resides

	// extract value from the stored json response data, assign to target variable
	if (action.action === 'custom_variable_set_via_jsonpath') {
	
		// get the json response data from the custom variable that holds the data
		let jsonResultData = ''
		//DEL let variableName = `custom_${action.options.jsonResultDataVariable}`
		self.getCustomVariableValue(action.options.jsonResultDataVariable, (value) => {
			jsonResultData = value
			self.debug('jsonResultData', jsonResultData)
		})

		// recreate a json object from stored json result data string
		let objJson = ''
		try {
			objJson = JSON.parse(jsonResultData)
		} catch (e) {
			self.log('error', `HTTP ${action.action.toUpperCase()} Cannot create JSON object, malformed JSON data (${e.message})`)
			return
		}

		// extract the value via the given standard JSONPath expression
		let valueToSet = ''
		try {
			valueToSet = jp.query(objJson, action.options.jsonPath)
		} catch (error) {
			self.log('error', `HTTP ${action.action.toUpperCase()} Cannot extract JSON value (${e.message})`)
			return
		}

		//DEL self.system.emit('custom_variable_set_value', action.options.targetVariable, valueToSet)
		self.setCustomVariableValue(action.options.targetVariable, valueToSet)

		return
	}

	if (action.action == 'custom_variable_set_value') {
		self.setCustomVariableValue(opt.name, opt.value)
	}
	else if (action.action === 'custom_variable_set_expression') {
		self.system.emit('custom_variable_set_expression', opt.name, opt.expression)
	}
	else if (action.action == 'custom_variable_store_variable') {
		let value = ''
		const id = opt.variable.split(':')
		self.system.emit('variable_get', id[0], id[1], (v) => (value = v))
		//FALSE (need 'internal' variable) self.getCustomVariableValue(id[1], (v) => (value =v))
		self.setCustomVariableValue(opt.name, value)
	}
}

instance_skel.extendedBy(instance)
exports = module.exports = instance
