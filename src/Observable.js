import { extend } from "./helpers"

export class Observable {
    _observed
    _listeners = new Set()

    constructor(v) {
        this._observed = v
    }

    set(v) {
        const old = this._observed
        if(v === old) return
        this._observed = v
        this._listeners.forEach(fn => fn(v, old))
    }

    get() {
        return this._observed
    }

    subscribe(fn, options) {
        if (typeof fn !== 'function') throw new Error('`fn` parameter must be a function')
        
        options = extend({
            autoRun: true
        }, options || {})

        if(options.autoRun) fn(this._observed, this._observed)
        this._listeners.add(fn)
        return () => this.unsubscribe(fn)
    }

    unsubscribe(fn) {
        return this._listeners.delete(fn)
    }
}

export class Computed {
    _defautConfig = {
        lazy: 'auto'
    }

    _observable
    _timeoutId
    _compute

    constructor(compute, dependencies, config) {
        this._compute = compute
        this._observable = new Observable(this._compute())
        const _config = extend(this._defautConfig, config);

        if(_config.lazy === 'auto') _config.lazy = dependencies.length !== 1 

        dependencies.forEach(observable => {
            if(
                !(observable instanceof Observable)
                && !(observable instanceof Computed)
            ) throw new Error('`dependencies` must be an array of Observable and Computed')
            if(_config.lazy === false) {
                observable.subscribe(() => this._update())
            } else {
                observable.subscribe(() => {
                    clearTimeout(this._timeoutId)
                    this._timeoutId = setTimeout(() => {
                        this._update()
                        this._timeoutId = undefined
                    }, 0)
                })
            }
        })
    }

    _update() {
        this._observable.set(this._compute())
    }

    get() {
        if(typeof this._timeoutId !== "undefined") this._update()
        return this._observable.get()
    }

    subscribe(fn) {
        return this._observable.subscribe(fn)
    }

    unsubscribe(fn) {
        return this._observable.subscribe(fn)
    }
}

/**
 *
 * @param {*} v observed initial value
 * @returns {Observable}
 */
export function observable(v) {
    return new Observable(v)
}

/**
 *
 * @param {Observable} observable
 * @returns {Computed} readonly version of the Observable
 */
export function readonly(observable) {
    return new Computed(() => observable.get(), [observable])
}
