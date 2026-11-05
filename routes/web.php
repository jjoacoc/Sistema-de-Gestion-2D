<?php

use App\Http\Controllers\AlmacenController;
use App\Http\Controllers\EstanteController;
use App\Http\Controllers\PanelController;
use App\Http\Controllers\ProductoController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PanelController::class, 'mostrar'])->name('panel');
Route::get('/almacen', [AlmacenController::class, 'mostrar'])->name('almacen');

// Datos en JSON que consulta el JavaScript
Route::get('/almacen/estantes', [AlmacenController::class, 'listarEstantes'])->name('almacen.estantes');
Route::get('/almacen/estantes/{estante}/productos', [AlmacenController::class, 'listarProductos'])->name('almacen.productos');
Route::get('/almacen/productos/sin-ubicar', [AlmacenController::class, 'listarSinUbicar'])->name('almacen.sin-ubicar');

// Estantes (modo edición)
Route::post('/estantes', [EstanteController::class, 'guardar'])->name('estantes.guardar');
Route::patch('/estantes/{estante}', [EstanteController::class, 'actualizar'])->name('estantes.actualizar');
Route::delete('/estantes/{estante}', [EstanteController::class, 'eliminar'])->name('estantes.eliminar');

// Productos
Route::post('/productos', [ProductoController::class, 'guardar'])->name('productos.guardar');
Route::patch('/productos/{producto}/stock', [ProductoController::class, 'ajustarStock'])->name('productos.stock');
Route::patch('/productos/{producto}/casillero', [ProductoController::class, 'moverACasillero'])->name('productos.casillero');
Route::patch('/productos/{producto}/ubicar', [ProductoController::class, 'ubicarEnEstante'])->name('productos.ubicar');
Route::patch('/productos/{producto}/mover', [ProductoController::class, 'mover'])->name('productos.mover');
Route::patch('/estantes/{estante}/geometria', [EstanteController::class, 'reubicar'])->name('estantes.geometria');