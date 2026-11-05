@extends('layouts.principal')

@section('titulo', 'Panel general')

@section('contenido')
    <h1 class="text-2xl font-bold mb-1">Panel general</h1>
    <p class="text-gray-600 mb-6">Resumen del stock del local.</p>

    {{-- Tarjetas con los totales --}}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-5">
            <p class="text-sm text-gray-500">Prendas (Modelos, Talle y Color)</p>
            <p class="text-3xl font-bold mt-1">{{ number_format($totalPrendas, 0, ',', '.') }}</p>
        </div>

        <div class="bg-white rounded-lg shadow p-5">
            <p class="text-sm text-gray-500">Unidades en stock</p>
            <p class="text-3xl font-bold text-blue-700 mt-1">{{ number_format($stockTotal, 0, ',', '.') }}</p>
        </div>

        <div class="bg-white rounded-lg shadow p-5">
            <p class="text-sm text-gray-500">Valor total del stock</p>
            <p class="text-3xl font-bold text-green-700 mt-1">$ {{ number_format($valorTotal, 2, ',', '.') }}</p>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {{-- Gráfico por categoría --}}
        <div class="bg-white rounded-lg shadow p-5" x-data="{ medida: 'unidades' }">
            <div class="flex items-center justify-between gap-3 mb-4">
                <h2 class="font-semibold">Stock por categoría</h2>

                {{-- Selector: cambia lo que miden las barras (lo recibe panel.js) --}}
                <div class="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                    <button type="button" @click="medida = 'unidades'; $dispatch('medida-grafico', 'unidades')"
                        :class="medida === 'unidades' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
                        class="px-3 py-1.5">Unidades</button>
                    <button type="button" @click="medida = 'valor'; $dispatch('medida-grafico', 'valor')"
                        :class="medida === 'valor' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
                        class="px-3 py-1.5">Valor ($)</button>
                </div>
            </div>

            @if ($porCategoria->isEmpty())
                <p class="text-sm text-gray-500">Todavía no hay prendas cargadas.</p>
            @else
                {{-- El alto lo fija este contenedor; Chart.js dibuja dentro del canvas --}}
                <div class="relative h-72">
                    <canvas id="grafico-categorias" data-categorias="{{ json_encode($porCategoria) }}"></canvas>
                </div>
            @endif
        </div>

        {{-- Lista de stock bajo --}}
        <div class="bg-white rounded-lg shadow p-5">
            <div class="flex items-center justify-between gap-3 mb-1">
                <h2 class="font-semibold">Stock bajo</h2>
                <a href="{{ route('almacen') }}" class="text-sm text-blue-600 hover:text-blue-800">Ir al almacén</a>
            </div>
            <p class="text-sm text-gray-500 mb-4">Prendas con {{ $limiteBajo }} unidades o menos.</p>

            @if ($stockBajo->isEmpty())
                <p class="text-sm text-gray-500">Ninguna prenda tiene stock bajo.</p>
            @else
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="text-left text-gray-500 border-b border-gray-200">
                                <th class="py-2 pr-3 font-medium">Prenda</th>
                                <th class="py-2 pr-3 font-medium">Talle · Color</th>
                                <th class="py-2 pr-3 font-medium">Estante</th>
                                <th class="py-2 text-right font-medium">Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($stockBajo as $prenda)
                                <tr class="border-b border-gray-100 last:border-0">
                                    <td class="py-2 pr-3">
                                        <p class="font-medium">{{ $prenda->nombre }}</p>
                                        <p class="text-xs text-gray-500">{{ $prenda->codigo }}</p>
                                    </td>
                                    <td class="py-2 pr-3">{{ $prenda->talle }} · {{ $prenda->color }}</td>
                                    <td class="py-2 pr-3">{{ $prenda->estante?->nombre ?? 'Sin ubicar' }}</td>
                                    <td class="py-2 text-right">
                                        {{-- Rojo si ya no queda ninguna unidad, ámbar si quedan pocas --}}
                                        <span
                                            class="inline-block min-w-8 text-center px-2 py-0.5 rounded-full font-semibold
                                                {{ $prenda->cantidad === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800' }}">
                                            {{ $prenda->cantidad }}
                                        </span>
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </div>
    </div>
@endsection

{{-- Chart.js solo se descarga en esta página (igual que Konva en el almacén) --}}
@push('scripts')
    @vite(['resources/js/panel.js'])
@endpush