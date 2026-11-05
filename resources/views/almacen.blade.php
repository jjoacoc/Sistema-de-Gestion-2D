@extends('layouts.principal')

@section('titulo', 'Almacén')

@section('contenido')
    {{--
    Todo el estado y el comportamiento de la página viven en resources/js/almacen/pagina.js ("almacen").
    Las direcciones del servidor se leen desde estos atributos data-.
    --}}
    <div x-data="almacen" data-url-stock="{{ route('productos.stock', ['producto' => '__ID__']) }}"
        data-url-crear="{{ route('productos.guardar') }}"
        data-url-estante="{{ route('estantes.actualizar', ['estante' => '__ID__']) }}"
        data-url-estante-nuevo="{{ route('estantes.guardar') }}">

        {{-- Cabecera --}}
        <div class="flex flex-wrap items-start gap-3 mb-4">
            {{-- flex-1 hace que el texto ocupe solo el espacio sobrante y se acomode en varias líneas --}}
            <div class="flex-1 min-w-64">
                <h1 class="text-2xl font-bold mb-1">Almacén</h1>
                <p class="text-gray-600">
                    Arrastra una miniatura a otro estante o a la zona "Sin ubicar" para moverla.
                    Pasa el mouse sobre una prenda para ver su código y precio, y haz doble click
                    para abrir su ficha y manejar el stock.
                </p>
            </div>

            {{-- ml-auto empuja los botones a la derecha, incluso si bajan a otra línea en pantallas chicas --}}
            <div class="ml-auto flex flex-wrap gap-2">
                <button @click="alternarEdicion()" :class="modoEdicion
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                    : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'"
                    class="px-4 py-2 rounded-lg whitespace-nowrap"
                    x-text="modoEdicion ? 'Salir del modo edición' : 'Editar mapa'"></button>

                <button @click="abrirFormulario()"
                    class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg whitespace-nowrap">
                    + Nuevo producto
                </button>
            </div>
        </div>

        {{-- Aviso del modo edición --}}
        <div x-show="modoEdicion" x-cloak
            class="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
            <strong>Modo edición.</strong>
            Arrastra un estante para moverlo (se acomoda a una grilla de 20 px y no puede pisar a otro) y usa las
            manijas azules para cambiarle el tamaño.
            Elige un estante para editar su nombre, capacidad o prendas por fila, o eliminarlo.
            Las miniaturas se ocultan mientras editas. En el panel lateral puedes crear estantes nuevos.
        </div>

        {{-- md:flex-row: el panel lateral queda al costado desde 768 px de ancho (con las herramientas
        del navegador abiertas la ventana suele ser más angosta que 1024 px) --}}
        <div class="flex flex-col md:flex-row gap-4">

            {{-- Zona del mapa --}}
            <div class="flex-1 min-w-0 bg-white rounded-lg shadow overflow-hidden">

                {{-- Barra de búsqueda y filtro --}}
                <div class="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100">
                    <input type="search" x-model="busqueda" @input.debounce.250ms="filtrar()"
                        placeholder="Buscar por nombre o código..."
                        class="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">

                    <select x-model="categoria" @change="filtrar()"
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                        <option value="">Todas las categorías</option>
                        <template x-for="nombre in categorias" :key="nombre">
                            <option :value="nombre" x-text="nombre"></option>
                        </template>
                    </select>

                    <button x-show="busqueda !== '' || categoria !== ''" @click="limpiar()"
                        class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
                        Limpiar
                    </button>

                    {{-- Contador de resultados (solo aparece si hay búsqueda) --}}
                    <p x-show="resultado.activo" x-text="textoResultado()" class="w-full text-sm text-gray-600"></p>
                </div>

                {{-- Aquí Konva dibuja el mapa. data-medidas lleva la grilla y los límites del modo edición --}}
                <div id="mapa-almacen" data-url="{{ route('almacen.estantes') }}"
                    data-url-mover="{{ route('productos.mover', ['producto' => '__ID__']) }}"
                    data-url-geometria="{{ route('estantes.geometria', ['estante' => '__ID__']) }}"
                    data-medidas="{{ json_encode($medidas) }}" class="w-full"></div>

                {{-- Mensajes del mapa (movimientos correctos o rechazados) --}}
                <p class="px-4 py-2 text-sm min-h-9 border-t border-gray-100" x-text="estadoMapa.mensaje" :class="{
                                                'text-green-600': estadoMapa.tipo === 'ok',
                                                'text-red-600': estadoMapa.tipo === 'error',
                                                'text-gray-500': estadoMapa.tipo === 'info'
                                            }"></p>
            </div>

            {{-- Panel lateral --}}
            <aside class="md:w-72 md:shrink-0 space-y-4">

                {{-- Información del estante seleccionado --}}
                <div class="bg-white rounded-lg shadow p-4">
                    <h2 class="font-semibold mb-2">Estante seleccionado</h2>
                    <p x-show="!estante" class="text-sm text-gray-500">Ninguno todavía.</p>

                    <div x-show="estante" class="space-y-1 text-sm">
                        <p class="text-lg font-bold" x-text="estante?.nombre"></p>
                        <p>Ocupación: <span x-text="estante?.ocupados"></span> de <span x-text="estante?.capacidad"></span>
                            productos</p>
                        <p>Espacio libre: <span x-text="estante ? estante.capacidad - estante.ocupados : ''"></span></p>

                        <button @click="abrir()"
                            class="mt-3 w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                            Abrir estante
                        </button>
                    </div>
                </div>

                {{-- Panel del modo edición --}}
                <div x-show="modoEdicion" x-cloak
                    class="bg-white rounded-lg shadow p-4 space-y-5 border-2 border-amber-300">

                    {{-- Estante nuevo --}}
                    <div>
                        <h2 class="font-semibold mb-2">Estante nuevo</h2>

                        <div class="space-y-2 text-sm">
                            <div>
                                <label class="block font-medium mb-1">Nombre</label>
                                <input type="text" x-model="nuevo.nombre" placeholder="Ej: Estante F"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400">
                                <p class="text-xs text-red-600 mt-1" x-text="primerError(erroresNuevo, 'nombre')"></p>
                            </div>

                            <div class="flex gap-2">
                                <div class="flex-1">
                                    <label class="block font-medium mb-1">Capacidad</label>
                                    <input type="number" min="1" max="{{ $limites['capacidad'] }}"
                                        x-model.number="nuevo.capacidad"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400">
                                    <p class="text-xs text-red-600 mt-1" x-text="primerError(erroresNuevo, 'capacidad')">
                                    </p>
                                </div>
                                <div class="flex-1">
                                    <label class="block font-medium mb-1">Por fila</label>
                                    <input type="number" min="1" max="{{ $limites['por_fila'] }}"
                                        x-model.number="nuevo.por_fila"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400">
                                    <p class="text-xs text-red-600 mt-1" x-text="primerError(erroresNuevo, 'por_fila')"></p>
                                </div>
                            </div>

                            <p class="text-xs text-red-600" x-text="primerError(erroresNuevo, 'general')"></p>

                            <button @click="crearEstante()" :disabled="guardandoEstante"
                                class="w-full px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg">
                                Crear estante
                            </button>
                        </div>
                    </div>

                    {{-- Editar el estante seleccionado --}}
                    <div x-show="estante" class="border-t border-gray-200 pt-4">
                        <h2 class="font-semibold mb-2">Editar <span x-text="estante?.nombre"></span></h2>

                        <div class="space-y-2 text-sm">
                            <div>
                                <label class="block font-medium mb-1">Nombre</label>
                                <input type="text" x-model="edicion.nombre"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400">
                                <p class="text-xs text-red-600 mt-1" x-text="primerError(erroresEstante, 'nombre')"></p>
                            </div>

                            <div class="flex gap-2">
                                <div class="flex-1">
                                    <label class="block font-medium mb-1">Capacidad</label>
                                    <input type="number" min="1" max="{{ $limites['capacidad'] }}"
                                        x-model.number="edicion.capacidad"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400">
                                    <p class="text-xs text-red-600 mt-1" x-text="primerError(erroresEstante, 'capacidad')">
                                    </p>
                                </div>
                                <div class="flex-1">
                                    <label class="block font-medium mb-1">Por fila</label>
                                    <input type="number" min="1" max="{{ $limites['por_fila'] }}"
                                        x-model.number="edicion.por_fila"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400">
                                    <p class="text-xs text-red-600 mt-1" x-text="primerError(erroresEstante, 'por_fila')">
                                    </p>
                                </div>
                            </div>

                            <p class="text-xs text-red-600" x-text="primerError(erroresEstante, 'general')"></p>

                            <div class="flex gap-2">
                                <button @click="guardarCambiosEstante()" :disabled="guardandoEstante"
                                    class="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg">
                                    Guardar cambios
                                </button>
                                <button @click="eliminarEstante()"
                                    class="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {{-- Leyenda de colores --}}
                <div class="bg-white rounded-lg shadow p-4">
                    <h2 class="font-semibold mb-2">Leyenda</h2>
                    <ul class="space-y-2 text-sm">
                        <li class="flex items-center gap-2"><span
                                class="w-4 h-4 rounded bg-gray-200 border-2 border-gray-400"></span> Vacío</li>
                        <li class="flex items-center gap-2"><span
                                class="w-4 h-4 rounded bg-green-200 border-2 border-green-600"></span> Con espacio</li>
                        <li class="flex items-center gap-2"><span
                                class="w-4 h-4 rounded bg-yellow-200 border-2 border-yellow-600"></span> Casi lleno (75% o
                            más)</li>
                        <li class="flex items-center gap-2"><span
                                class="w-4 h-4 rounded bg-red-200 border-2 border-red-600"></span> Lleno</li>
                    </ul>
                </div>
            </aside>
        </div>

        {{-- ================= Ventana: estante ampliado ================= --}}
        <div x-show="modalAbierto" x-cloak @click.self="cerrar()"
            class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div class="bg-white rounded-xl shadow-xl w-full max-w-6xl p-4">

                {{-- Cabecera: nombre del estante y ocupación en vivo --}}
                <div class="flex items-center justify-between mb-3">
                    <h2 class="text-xl font-bold"
                        x-text="estante ? 'Interior de ' + estante.nombre + ' (' + estante.ocupados + ' / ' + estante.capacidad + ')' : ''">
                    </h2>
                    <button @click="cerrar()" class="text-gray-500 hover:text-gray-800 text-2xl leading-none"
                        title="Cerrar">&times;</button>
                </div>

                <div class="flex flex-col md:flex-row gap-4">

                    <div class="flex-1 min-w-0">
                        {{-- Aquí Konva dibuja el interior del estante.
                        Si el estante tiene muchas filas, aparece una barra de desplazamiento vertical --}}
                        <div id="interior-estante"
                            data-url-productos="{{ route('almacen.productos', ['estante' => '__ID__']) }}"
                            data-url-casillero="{{ route('productos.casillero', ['producto' => '__ID__']) }}"
                            data-url-sin-ubicar="{{ route('almacen.sin-ubicar') }}"
                            data-url-ubicar="{{ route('productos.ubicar', ['producto' => '__ID__']) }}"
                            class="w-full rounded-lg border border-gray-200 overflow-x-hidden overflow-y-auto max-h-[420px] [scrollbar-gutter:stable]">
                        </div>

                        {{-- Mensajes de estado --}}
                        <p class="mt-3 text-sm min-h-5" x-text="estado.mensaje" :class="{
                                                        'text-green-600': estado.tipo === 'ok',
                                                        'text-red-600': estado.tipo === 'error',
                                                        'text-gray-500': estado.tipo === 'info'
                                                    }"></p>
                    </div>

                    {{-- Panel de prendas sin ubicar --}}
                    <div class="md:w-60">
                        <h3 class="font-semibold mb-1">Sin ubicar (<span x-text="sinUbicar.length"></span>)</h3>
                        <p class="text-xs text-gray-500 mb-2">Arrastra una prenda hacia un casillero libre.</p>

                        <p x-show="sinUbicar.length === 0" class="text-sm text-gray-500">
                            Todas las prendas están ubicadas.
                        </p>

                        <ul class="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                            <template x-for="producto in sinUbicar" :key="producto.id">
                                <li draggable="true" @dragstart="empezarArrastre($event, producto)"
                                    class="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg cursor-grab hover:bg-blue-50">
                                    {{-- draggable="false" evita que el navegador arrastre solo la imagen --}}
                                    <img x-show="producto.imagen_url" :src="producto.imagen_url" draggable="false"
                                        class="w-12 h-12 object-contain" alt="">
                                    <div x-show="!producto.imagen_url" class="w-12 h-12 bg-gray-300 rounded"></div>

                                    <div class="min-w-0 text-sm">
                                        <p class="font-semibold truncate" x-text="producto.nombre"></p>
                                        <p class="text-gray-500" x-text="producto.talle + ' · ' + producto.color"></p>
                                    </div>
                                </li>
                            </template>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        {{-- ================= Ventana: ficha de la prenda (stock) ================= --}}
        <div x-show="ficha" x-cloak @click.self="cerrarFicha()"
            class="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
            <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-5">

                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="min-w-0">
                        <h2 class="text-xl font-bold truncate" x-text="ficha?.nombre"></h2>
                        <p class="text-sm text-gray-500" x-text="ficha ? ficha.codigo + ' · ' + ficha.categoria : ''"></p>
                    </div>
                    <button @click="cerrarFicha()" class="text-gray-500 hover:text-gray-800 text-2xl leading-none"
                        title="Cerrar">&times;</button>
                </div>

                <div class="flex gap-4 mb-4">
                    <div class="w-28 h-28 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                        <img x-show="ficha?.imagen_url" :src="ficha?.imagen_url" alt=""
                            class="max-w-full max-h-full object-contain">
                        <span x-show="!ficha?.imagen_url" class="text-xs text-gray-400">Sin imagen</span>
                    </div>

                    <dl class="text-sm space-y-1">
                        <div>
                            <dt class="inline text-gray-500">Talle:</dt>
                            <dd class="inline font-medium" x-text="ficha?.talle"></dd>
                        </div>
                        <div>
                            <dt class="inline text-gray-500">Color:</dt>
                            <dd class="inline font-medium" x-text="ficha?.color"></dd>
                        </div>
                        <div>
                            <dt class="inline text-gray-500">Precio:</dt>
                            <dd class="inline font-medium" x-text="precioFicha()"></dd>
                        </div>
                    </dl>
                </div>

                {{-- Stock actual --}}
                <div class="rounded-lg bg-blue-50 p-3 mb-4 text-center">
                    <p class="text-sm text-gray-600">Stock actual</p>
                    <p class="text-3xl font-bold text-blue-700" x-text="ficha?.cantidad"></p>
                </div>

                {{-- Sumar o restar unidades --}}
                <div class="flex items-center gap-2">
                    <input type="number" min="1" x-model.number="cantidadMovimiento"
                        class="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <button @click="ajustarStock('entrada')"
                        class="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                        + Sumar
                    </button>
                    <button @click="ajustarStock('salida')"
                        class="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                        − Restar
                    </button>
                </div>

                <p class="mt-3 text-sm min-h-5" x-text="estadoFicha.mensaje" :class="{
                                                'text-green-600': estadoFicha.tipo === 'ok',
                                                'text-red-600': estadoFicha.tipo === 'error',
                                                'text-gray-500': estadoFicha.tipo === 'info'
                                            }"></p>
            </div>
        </div>

        {{-- ================= Ventana: producto nuevo ================= --}}
        <div x-show="formularioAbierto" x-cloak @click.self="cerrarFormulario()"
            class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
            <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5 my-auto">

                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-bold">Nuevo producto</h2>
                    <button @click="cerrarFormulario()" class="text-gray-500 hover:text-gray-800 text-2xl leading-none"
                        title="Cerrar">&times;</button>
                </div>

                <form @submit.prevent="crearProducto()" class="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    <div class="sm:col-span-2">
                        <label class="block text-sm font-medium mb-1">Nombre</label>
                        <input type="text" x-model="formulario.nombre" placeholder="Ej: Remera básica"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('nombre')"></p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">Categoría</label>
                        <select x-model="formulario.categoria"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Elige una categoría</option>
                            @foreach ($categorias as $nombreCategoria)
                                <option value="{{ $nombreCategoria }}">{{ $nombreCategoria }}</option>
                            @endforeach
                        </select>
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('categoria')"></p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">Talle</label>
                        <input type="text" x-model="formulario.talle" placeholder="Ej: M, 42, Único"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('talle')"></p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">Color</label>
                        <input type="text" x-model="formulario.color" placeholder="Ej: Negro"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('color')"></p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">Precio</label>
                        <input type="number" min="0" step="0.01" x-model="formulario.precio" placeholder="Ej: 12500"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('precio')"></p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">Cantidad inicial</label>
                        <input type="number" min="0" x-model.number="formulario.cantidad"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('cantidad')"></p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">Código <span
                                class="text-gray-400 font-normal">(opcional)</span></label>
                        <input type="text" x-model="formulario.codigo" placeholder="Se genera solo, ej: REM-NEG-M"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('codigo')"></p>
                    </div>

                    <div class="sm:col-span-2">
                        <label class="block text-sm font-medium mb-1">Imagen <span
                                class="text-gray-400 font-normal">(opcional, PNG, JPG o WEBP de hasta 2 MB)</span></label>

                        <div class="flex items-center gap-3">
                            <input type="file" accept="image/png,image/jpeg,image/webp" @change="elegirImagen($event)"
                                class="flex-1 text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200">

                            {{-- Vista previa de la imagen elegida --}}
                            <img x-show="vistaPrevia" :src="vistaPrevia" alt="Vista previa"
                                class="w-16 h-16 object-contain rounded border border-gray-200">
                        </div>
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('imagen')"></p>
                    </div>

                    <p class="sm:col-span-2 text-sm text-red-600" x-text="errorDe('general')"></p>

                    <div class="sm:col-span-2 flex justify-end gap-2 mt-2">
                        <button type="button" @click="cerrarFormulario()"
                            class="px-4 py-2 text-gray-600 hover:text-gray-900">
                            Cancelar
                        </button>
                        <button type="submit" :disabled="guardando"
                            class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg">
                            <span x-text="guardando ? 'Guardando...' : 'Crear producto'"></span>
                        </button>
                    </div>
                </form>

                <p class="text-xs text-gray-500 mt-3">El producto nuevo aparece en la zona "Sin ubicar" del mapa, listo para
                    arrastrarlo a un estante.</p>
            </div>
        </div>
    </div>
@endsection

{{-- Scripts de esta página: el mapa y el estante ampliado --}}
@push('scripts')
    @vite(['resources/js/almacen/mapa.js', 'resources/js/almacen/interior.js'])
@endpush