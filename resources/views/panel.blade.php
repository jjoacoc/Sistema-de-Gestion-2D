@extends('layouts.principal')

@section('titulo', 'Panel general')

@section('contenido')
    <h1 class="text-2xl font-bold mb-4">Panel general</h1>
    <p class="text-gray-600">Aquí irá el resumen del stock.</p>

    {{-- PRUEBA TEMPORAL de Alpine.js: bórrala cuando confirmes que funciona --}}
    <div x-data="{ clics: 0 }" class="mt-6">
        <button @click="clics++" class="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Probar Alpine
        </button>
        <span class="ml-3" x-text="'Clics: ' + clics"></span>
    </div>
@endsection