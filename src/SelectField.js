import { BaseField } from "./BaseField"
import { createElement, removeDiacritics, extend, debounce } from "./helpers"
import { Observable, Computed } from "./Observable"
import { Floater } from "./Floater"
import { BiDirectionalMap } from "bi-directional-map/dist/index"

export function SelectField(container, config) {

    if (!(this instanceof SelectField)) {
        throw new Error("SelectField must be called using 'new' keyword")
    }

    if (!(container instanceof HTMLElement)) {
        throw new Error("container should be an HTMLElement")
    }

    this.defaultConfig = {
        filterable: false,
        searchable: false,
        queryInputMode: 'root', // root, dropdown
        count: true,
        defaultSelected: false,
        allowDeselect: true,
        texts: {
            filtrablePlaceholder: 'Filter options...',
            filtrableNoOptionsFound: 'No options match your filter',
            searchablePlaceholder: 'Search options...',
            searchableQueryEmpty: 'Please enter at least one character to show options',
            searchableNoOptionsFound: 'No options match your search',
            noOptionsFound: 'No options available',
        }
    }

    this.eventTypes = [
        'change',
        'open',
        'close',
    ]

    this.config = undefined
    this.container = undefined
    this.baseField = undefined
    this.select = undefined
    this.options = undefined
    this.selectedOptions = undefined
    this.nativeOptionsElements = {}
    this.optionsElements = {}
    this.filterQuery = undefined
    this.searchQuery = undefined
    this.isOpen = undefined
    this.navIndex = undefined
    this.isNavigating = undefined
    this.selectedDisplay = undefined
    this.dropdown = undefined
    this.optionsContainer = undefined
    this.typedTextTimoutId = undefined
    this.lastTypedText = ""
    this.queryInput = undefined

    this.init = function () {
        this.container = container
        this.select = this.container.querySelector('select.field__input')

        if (!(this.select instanceof HTMLSelectElement)) {
            throw new Error("the container should contains a 'input.field__input' element with a type not equal to radio or checkbox")
        }

        // Merge defaults with user set config
        this.config = extend(this.defaultConfig, config)

        if (this.config.searchable && typeof this.config.searchable !== 'function') {
            console.error('searchable configuration must be a function that accept a query and return options in the folowing format : {?id: string, value: string, ?label: string}')
            this.config.searchable = false
        }

        if (this.config.searchable && this.config.filterable) {
            console.error('can\'t be searchable and filterable at once')
            this.config.filterable = false
        }

        if(!['undefined', 'boolean'].includes(typeof this.config.filterable)) {
            console.error('filterable configuration must be a boolean')
            this.config.filterable = false
        }

        this.baseField = new BaseField(this.container)
        this.baseField.value.set([])
        this.isOpen = new Observable(false)
        this.navIndex = new Observable(undefined)
        this.isNavigating = new Observable(true)
        this.options = new Observable([])
        this.selectedOptions = new Observable([])
        this.filterQuery = new Observable("")
        this.searchQuery = new Observable("")
        this.filteredOptions = new Computed(() => this.options.get().filter(v => v.matchFilter.get()), [this.options, this.filterQuery])
        this.optionsIds = new Computed(() => new BiDirectionalMap(this.options.get().map(option => [option.id, option])), [this.options])

        this.selectedDisplay = createElement('button', {
            classList: ['field__selected'],
            properties: {
                type: 'button'
            }
        })

        this.selectedDisplayValue = createElement('span', {
            classList: ['field__selectedValue'],
            children: [' '],
        })

        this.selectedDisplay.appendChild(this.selectedDisplayValue)

        if(this.config.allowDeselect) {
            this.deselectAllButton = createElement('button', {
                classList: ['field__deselectAll'],
                children: ['X'],
                properties: {
                    type: 'button'
                }
            })
    
            this.deselectAllButton.addEventListener('click', () => {
                this.deselectAll()
                this.close()
            })
        }


        this.dropdown = createElement('div', {
            classList: ['field__dropdown']
        })

        this.optionsContainer = createElement('div', {
            classList: ['field__options', this.select.multiple ? 'multiple' : 'simple']
        })

        this.optionsContainerMessages = createElement('div', {
            classList: ['field__optionsMessages']
        })

        this.dropdownFloater = new Floater(this.container, this.dropdown)

        this.container.addEventListener('keydown', this.onKeydownContainer)
        this.selectedDisplay.addEventListener('keydown', this.onKeydownSelectedDisplay)
        this.optionsContainer.addEventListener('keydown', this.onKeydownDropdown)

        this.selectedDisplay.addEventListener('pointerdown', e => {
            e.preventDefault()
            this.isOpen.get() ? this.close() : this.open()
        })

        const onOptionsContainerPointermove = () => { this.isNavigating.set(false) }

        onOptionsContainerPointermove()

        this.isNavigating.subscribe(value => {
            if (value) this.optionsContainer.addEventListener('pointermove', onOptionsContainerPointermove, { passive: true })
            else this.optionsContainer.removeEventListener('pointermove', onOptionsContainerPointermove)
            this.optionsContainer.classList.toggle('isNavigating', this.isNavigating.get())
            this.optionsContainer.classList.toggle('isNotNavigating', !this.isNavigating.get())
        })

        const tempOptions = []
        for (let i = 0; i < this.select.options.length; i++) {
            const nativeOption = this.select.options[i]

            let jsonData = nativeOption.dataset.json

            if( typeof jsonData !== 'undefined') {
                if(jsonData.trim() === '') jsonData = undefined
                else {
                    try {
                        jsonData = JSON.parse(jsonData)
                    } catch (error) {
                        jsonData = undefined
                        console.error('unable to parse data-json Attribue', error)
                    }
                }
            }

            tempOptions.push({
                label: nativeOption.textContent,
                value: nativeOption.value,
                selected: this.config.defaultSelected
                    ? nativeOption.selected
                    : nativeOption.hasAttribute('selected'),
                data: jsonData
            })
        }

        this.setOptions(tempOptions)

        this.container.appendChild(this.selectedDisplay)
        if (this.config.count === true) this.setupContDisplay()
        if(this.deselectAllButton) this.container.appendChild(this.deselectAllButton)
        this.dropdown.appendChild(this.optionsContainer)
        this.container.appendChild(this.dropdown)

        this.select.classList.add('field__input--hidden')
        this.select.tabIndex = -1

        // dans le cas ou le navigateur met le focus sur le select (lors de la validation native)
        this.select.addEventListener('keydown', this.onKeydownSelectedDisplay)

        this.isOpen.subscribe(() => {
            this.container.classList.toggle('isOpen', this.isOpen.get())
        })

        this.baseField.isFocus.subscribe(() => {
            if (!this.baseField.isFocus.get()) this.close(false)
        })

        this.selectedOptions.subscribe(() => {
            const displayValue = this.renderSelectedDisplay()
            this.selectedDisplayValue.innerHTML = displayValue === "" ? "&nbsp;" : displayValue
            this.selectedDisplay.title = displayValue

            if (this.selectedOptions.get().length < 1) {
                this.select.selectedIndex = -1
            }
        })

        this.optionsIds.subscribe((ids) => {
            this.navIndex.set(undefined)
            this.optionsContainer.textContent = ""
            this.optionsContainer.scrollTop = 0

            if(!this.config.filterable) {
                this.displayEmptyMessage(ids.size)
            }

            if(ids.size > 0) {
                for (let i = 0; i < ids.size; i++) {
                    const optionElement = this.createOptionElement(i)

                    if (optionElement) this.optionsContainer.appendChild(optionElement)
                }
            }

            // cleanup

            for (const id in this.optionsElements) {
                if (ids.hasKey[id]) continue
                delete this.optionsElements[id]
            }

            for (const id in this.nativeOptionElement) {
                if (ids.hasKey[id]) continue
                delete this.nativeOptionElement[id]
            }
        })

        this.selectedOptions.subscribe(options => {
            this.select.textContent = ""
            options.forEach(option => {
                this.select.appendChild(createElement('option', {
                    properties: {
                        value: option.value,
                        selected: true
                    }
                }))
            })
        })

        if (this.config.searchable) this.initSearchable()

        if (this.config.filterable) {
            this.initFilterable()
            this.filteredOptions.subscribe(options => {
                this.displayEmptyMessage(options.length)
            })
        }

        if (this.queryInput) {
            if (this.select.multiple) this.selectedOptions.subscribe(() => this.clearQueryInput())
            else this.isOpen.subscribe(isOpen => { if (!isOpen) this.clearQueryInput() })
        }

        this.optionsContainer.tabIndex = this.queryInput ? -1 : 0

        if (this.queryInput && this.config.queryInputMode === "root" && this.select.multiple) {
            const tagsContainer = createElement('div', {
                classList: ['field__tags']
            })

            this.dropdown.prepend(tagsContainer)

            this.selectedOptions.subscribe(options => {
                tagsContainer.textContent = ""

                options.forEach(option => {

                    const tag = createElement('button', {
                        classList: ['field__tag'],
                        properties: { type: 'button' },
                        children: [
                            createElement('span', {
                                classList: ['field__tagValue'],
                                children: [option.label]
                            }),
                            createElement('span', {
                                classList: ['field__tagDeselect'],
                                children: ['X']
                            })
                        ]
                    })

                    tag.addEventListener('click', () => {
                        this.deselectOption(option.id)

                        if(this.queryInput) this.queryInput.focus()
                    })

                    tagsContainer.appendChild(tag)
                })
            })
        }
    }

    this.close = function (autofocus) {
        autofocus = typeof autofocus === 'undefined' ? true : autofocus
        if (this.isOpen.get()) {
            this.isOpen.set(false)
            if (autofocus) this.selectedDisplay.focus()
            this.dropdownFloater.close()
        }
    }

    this.open = function () {
        if (!this.isOpen.get()) {
            this.isOpen.set(true)
            this.dropdownFloater.open()
            const focusTarget = this.queryInput || this.optionsContainer
            focusTarget.focus()
        }
    }

    this.createOptionElement = function (optionId) {

        const option = this.options.get()[optionId]

        if (!option) return

        if (this.optionsElements[option.id]) return this.optionsElements[option.id]

        const optionElement = createElement('div', {
            classList: ['field__option'],
        })

        optionElement.innerHTML = option.labelHTML || option.label

        option.selected.subscribe(() => {
            optionElement.classList.toggle('isSelected', option.selected.get())
            if (option.selected.get() && !this.select.multiple) this.scrolloptionElementIntoView(optionElement)
        })

        option.active.subscribe(() => {
            optionElement.classList.toggle('isActive', option.active.get())
            if (option.active.get() && this.select.multiple) this.scrolloptionElementIntoView(optionElement)
        })

        option.matchFilter.subscribe(() => {
            optionElement.classList.toggle('hide', !option.matchFilter.get())
        })

        optionElement.addEventListener('click', e => {
            e.preventDefault()
            if(this.config.allowDeselect === false && !this.select.multiple) {
                this.selectOption(option.id)
            } else {
                this.toggleOption(option.id)
            }
            if (!this.select.multiple) this.close()
        })

        this.optionsElements[option.id] = optionElement
        return optionElement
    }

    this.createOption = function ({ label, labelHTML, value, id, data }) {
        if (typeof id !== "number" && typeof id !== "string") throw new Error('id must be a string, a number or a "falsy" value')

        const normalizedLabel = this.normalizeString(label)
        const index = new Computed(() => [...this.optionsIds.get().keys()].indexOf(id), [this.optionsIds])

        const option = {
            id,
            index: index,
            label,
            labelHTML,
            value,
            data,
            selected: new Computed(() => this.baseField.value.get().includes(id), [this.baseField.value]),
            active: new Computed(() => this.select.multiple && index.get() === this.navIndex.get(), [this.navIndex]),
            matchFilter: new Computed(() => {
                return this.filterQuery.get() === "" || normalizedLabel.indexOf(this.filterQuery.get()) > -1
            }, [this.filterQuery]),
        }

        return option
    }

    this.setOptions = function (options) {
        const tempOptions = []
        const ids = []
        const selectedIds = []
        for (let i = 0; i < options.length; i++) {
            if (!options[i].id && typeof options[i].id !== "number") options[i].id = this.uid.get()
            if (['string', 'number'].includes(typeof options[i].id)) {
                if (ids.includes(options[i].id)) {
                    console.warn('an option with the same id (' + options[i].id + ') already exist')
                    continue
                } else {
                    ids.push(options[i].id)
                }
            }
            if(options[i].selected) selectedIds.push(options[i].id)
            tempOptions.push(this.createOption(options[i]))
        }


        this.options.set(tempOptions)
        selectedIds.forEach(id => this.selectOption(id))
    }

    this.onKeydownSelectedDisplay = e => {
        if (![" ", "Enter", "ArrowDown", "ArrowUp"].includes(e.key)) return
        e.preventDefault()
        this.isOpen.get() ? this.close() : this.open()
        return
    }

    this.onKeydownContainer = e => {
        if (this.isOpen.get() && e.key === 'Escape') {
            e.preventDefault()
            this.close()
            return
        }

        // si le queryInput est focus on ne fait rien
        if (this.queryInput && document.activeElement === this.queryInput) return

        // on verifie que le charactère est imprimable et n'est pas un espace (ignore espace, esc, tab, vermaj, maj, f1, f2...)
        if (e.key.length !== 1 || e.key === ' ') return

        if (this.select.multiple) this.open()

        this.isNavigating.set(true)
        this.lastTypedText += e.key

        const findedOption = this.findFirstMatchingOption(this.lastTypedText)

        if (findedOption) {
            if (this.select.multiple) this.navIndex.set(findedOption.index.get())
            else this.selectOption(findedOption.id)
        }

        if (this.typedTextTimoutId) {
            clearTimeout(this.typedTextTimoutId)
            this.typedTextTimoutId = undefined
        }

        this.typedTextTimoutId = setTimeout(() => {
            this.lastTypedText = ""
        }, 700)
    }

    this.onKeydownDropdown = e => {

        if ([" ", "Enter"].includes(e.key)) {
            e.preventDefault()
            if (this.select.multiple) {
                const option = this.options.get()[this.navIndex.get()]
                if (option) {
                    if(this.config.allowDeselect === false && !this.select.multiple) {
                        this.selectOption(option.id)
                    } else {
                        this.toggleOption(option.id)
                    }
                }
            } else this.close()

            return
        }

        if (!["ArrowDown", "ArrowUp"].includes(e.key)) return

        e.preventDefault()
        this.isNavigating.set(true)

        let absoluteCurrentIndex

        if (this.select.multiple) absoluteCurrentIndex = this.navIndex.get()

        if (typeof absoluteCurrentIndex === "undefined") {
            let lastOptionSelected = this.selectedOptions.get()[this.selectedOptions.get().length - 1]
            if (lastOptionSelected) absoluteCurrentIndex = lastOptionSelected.index.get()
        }

        let currentIndex

        if (typeof absoluteCurrentIndex !== "undefined") {
            const currentOption = this.options.get()[absoluteCurrentIndex]
            if (currentOption) {
                const relativeIndex = this.filteredOptions.get().indexOf(currentOption)
                if (relativeIndex > -1) currentIndex = relativeIndex
            }
        }

        if (typeof currentIndex !== "undefined") {
            const optionsLength = this.filteredOptions.get().length
            if (e.key === "ArrowUp") currentIndex--
            else if (e.key === "ArrowDown") currentIndex++
            if (currentIndex < 0) currentIndex = optionsLength - 1
            else if (currentIndex > optionsLength - 1) currentIndex = 0
        } else {
            currentIndex = 0
        }

        const option = this.filteredOptions.get()[currentIndex]

        if (option) {
            if (this.select.multiple) {
                if (typeof option.index.get() === 'number') this.navIndex.set(option.index.get())
            } else {
                this.selectOption(option.id)
            }
        }
    }

    this.findMatchingOptions = function (query, options, first) {
        query = this.normalizeString(query)
        const finded = []
        for (let i = 0; i < options.length; i++) {
            const option = options[i]
            const valueToCompare = removeDiacritics(option.label.trim().substring(0, query.length).toLowerCase())
            if (valueToCompare === query) {
                const result = option
                if (first) return result
                finded.push(result)
            }
        }

        if (first) return null
        return finded
    }

    this.normalizeString = function (string) {
        return removeDiacritics(string.trim().toLowerCase().replace(/\s{2,}/, ' '))
    }

    this.findFirstMatchingOption = function (query) {
        return this.findMatchingOptions(query, this.filteredOptions.get(), true)
    }

    this.scrolloptionElementIntoView = function (optionElement) {
        const st = this.optionsContainer.scrollTop
        const top = optionElement.offsetTop
        const bottom = optionElement.offsetTop + optionElement.offsetHeight - this.optionsContainer.offsetHeight

        if (st <= top && st >= bottom) return

        this.optionsContainer.scrollTop = st > top ? top : bottom
    }

    this.toggleOption = function (id) {
        if (this.baseField.value.get().includes(id)) this.deselectOption(id)
        else this.selectOption(id)
    }

    this.selectOption = function (id) {
        if (this.baseField.value.get().includes(id)) return

        const option = this.optionsIds.get().getValue(id)

        if (!option) return

        if (this.select.multiple) {
            this.baseField.value.set([...this.baseField.value.get(), id])
            this.selectedOptions.set([...this.selectedOptions.get(), option])
        } else {
            this.baseField.value.set([id])
            this.selectedOptions.set([option])
        }
    }

    this.deselectOption = function (id) {
        const option = this.selectedOptions.get().find((option) => option.id === id)

        if (!option) return

        this.baseField.value.set(this.baseField.value.get().filter((optionId) => optionId !== id))
        this.selectedOptions.set(this.selectedOptions.get().filter((option) => option.id !== id))
    }

    this.deselectAll = function () {
        this.baseField.value.set([])
        this.selectedOptions.set([])
    }

    this.renderSelectedDisplay = function () {
        if (!this.selectedOptions.get().length === 0) return ""
        return this.selectedOptions.get().reduce((acc, option) => {
            acc.push(option.label)
            return acc
        }, []).join(', ')
    }

    this.setupQueryInput = function () {
        const queryInputContainer = createElement('div', { classList: ['field__queryInputContainer'] })
        const queryInputLoader = createElement('span', { classList: ['field__queryInputLoader'] })
        this.queryInput = createElement('input', {
            classList: ['field__input', 'field__queryInput'],
            properties: { type: 'search' }
        })

        queryInputContainer.appendChild(this.queryInput)
        queryInputContainer.appendChild(queryInputLoader)

        this.optionsContainer.addEventListener('pointerdown', e => {
            // permet d'evier que "queryInput" perdent le focus au clic
            // solution temporaire à changer au plus vite
            // il faut trouver une meilleure façon de gérer le focus
            e.preventDefault()
            e.stopPropagation()
            this.queryInput.focus()
        })

        if (this.config.queryInputMode === "dropdown") {
            this.container.classList.add('field--queryInputDropdown')
            this.dropdown.prepend(queryInputContainer)
        } else if (this.config.queryInputMode === "root") {
            this.container.classList.add('field--queryInputRoot')
            this.container.prepend(queryInputContainer)
        }

        this.queryInput.addEventListener('keydown', e => {
            // si le queryInput est focus est que la touche est espace on ne fait rien
            if (e.key === " ") return
            this.onKeydownDropdown(e)
        })

        if (typeof this.queryInput === HTMLInputElement) {
            throw new Error("Internal Error : this.queryInput should be an HTMLInputElement , got '" + typeof this.queryInput + "'")
        }

        return this.queryInput
    }

    this.initFilterable = function () {
        const queryInput = this.setupQueryInput()

        queryInput.placeholder = this.txt('filtrablePlaceholder')

        const onInput = () => {
            this.filterQuery.set(this.normalizeString(queryInput.value))
        }

        queryInput.addEventListener('change', onInput)
        queryInput.addEventListener('input', onInput)
    }

    this.initSearchable = function () {
        const queryInput = this.setupQueryInput()

        queryInput.placeholder = this.txt('searchablePlaceholder')

        let abortControler = new AbortController()

        const debouncedSearch = debounce(() => {
            abortControler.abort()
            abortControler = new AbortController()
            
            const signal = abortControler.signal

            const setOptions = (options) => {
                if(signal.aborted) return
                this.setOptions(options)
                this.container.classList.remove('isQuerying')
            }

            Promise.resolve(this.config.searchable(this.searchQuery.get()))
                .then(setOptions)
        }, 300)


        this.searchQuery.subscribe(() => {
            this.container.classList.add('isQuerying')
            debouncedSearch()
        })

        const onInput = () => {
            this.searchQuery.set(queryInput.value)
        }

        queryInput.addEventListener('change', onInput)
        queryInput.addEventListener('input', onInput)
    }

    this.clearQueryInput = function () {
        if (this.config.searchable) {
            this.setOptions([])
            this.searchQuery.set('')
        } else if (this.config.filterable) {
            this.filterQuery.set('')
        }
        this.queryInput.value = ''
    }

    this.setupContDisplay = function () {
        const countDisplay = createElement('span', {
            classList: ['field__count'],
        })

        this.baseField.value.subscribe(value => {
            const mustDisplayCount = value.length > 1
            this.container.classList.toggle('hasCount', mustDisplayCount)
            countDisplay.innerText = mustDisplayCount ? value.length : ''
        })

        this.selectedDisplay.appendChild(countDisplay)
    }

    this.displayEmptyMessage = function (countOptions) {
        let message = ''

        if (countOptions === 0) {
            if(this.config.searchable) {
                message = this.txt(
                    this.searchQuery.get() === ''
                    ? 'searchableQueryEmpty'
                    : 'searchableNoOptionsFound'
                )
            } else if (this.config.filterable) {
                if(this.filterQuery.get() !== '') message = this.txt('filtrableNoOptionsFound')
            } else {
                message = this.txt('noOptionsFound')
            }

            this.optionsContainerMessages.textContent = message
        }

        if(message.trim() !== '') {
            this.optionsContainer.appendChild(this.optionsContainerMessages)
        } else if(
            this.optionsContainerMessages.parentElement &&
            this.optionsContainerMessages.parentElement === this.optionsContainer
        ) {
            this.optionsContainer.removeChild(this.optionsContainerMessages)
        }
    }

    this.getValue = function() {
        const cleanValue = this.selectedOptions.get()
            .map(({id, value, label, labelHTML, data}) => ({
                id,
                value,
                label,
                labelHTML,
                data
            }))

        if (this.select.multiple) return cleanValue
        else return cleanValue.length > 0 ? cleanValue[0] : null
    }

    this.txt = function (key) {
        return typeof this.config.texts[key] === 'string' ? this.config.texts[key] : key
    }

    this.uid = (function () {
        let id = 0

        return {
            get: () => '_select_option_' + (id++),
            reset: () => { id = 0 }
        }
    })()

    this.init()
    return Object.defineProperties({}, {
        on: {
            value: (eventType, listener) => {
                if (!this.eventTypes.includes(eventType)) {
                    throw new Error("eventType must be one of this values : " + this.eventTypes.join(', ') + " | given value : " + eventType)
                }

                if (typeof listener !== 'function') throw new Error('listener must be a function')

                if (eventType === 'change') {
                    this.selectedOptions.subscribe(() => {
                        listener(this.getValue())
                    }, { autoRun: false })
                    return
                }

                if (eventType === 'open') {
                    this.isOpen.subscribe(isOpen => {
                        if(isOpen) listener()
                    }, { autoRun: false })
                    return
                }

                if (eventType === 'close') {
                    this.isOpen.subscribe(isOpen => {
                        if(isOpen) listener()
                    }, { autoRun: false })
                    return
                }
            },
            writable: false
        },
        deselectAll: {
            value: () => this.deselectAll(),
            writable: false
        },
        clearQueryInput: {
            value: () => this.clearQueryInput(),
            writable: false
        },
        open: {
            value: () => this.open(),
            writable: false
        },
        close: {
            value: () => this.close(),
            writable: false
        },
        getValue: {
            value: () => this.getValue(),
            writable: false
        },
        setSelectedOptions: {
            value: (options) => {
                const tempOptions = []
                const tempIds = []
                for (let i = 0; i < options.length; i++) {
                    const optionValues = options[i]
                    let option
                    if (['string', 'number'].includes(typeof optionValues.id)) {
                        option = this.optionsIds.get().getValue(optionValues.id)
                    } else {
                        optionValues.id = this.uid.get()
                    }

                    if(!option) option = this.createOption(optionValues)

                    if(option) {
                        tempOptions.push(option)
                        tempIds.push(option.id)
                    }
                }
            
                this.baseField.value.set(tempIds)
                this.selectedOptions.set(tempOptions)
            },
            writable: false
        },
        setValue: {
            value: (value) => {
                const options = this.options.get().filter(option => value.includes(option.value))

                this.baseField.value.set(options.map(opt => opt.id))
                this.selectedOptions.set(options)
            }
        },
        getOptions: {
            value: () => {
                return this.options.get()
                    .map(({ id, value, label, labelHTML, data }) => {
                        return { id, value, label, labelHTML, data }
                    })
            },
            writable: false
        },
        setOptions: {
            value: (options) => this.setOptions(options),
            writable: false
        }
    })
}
