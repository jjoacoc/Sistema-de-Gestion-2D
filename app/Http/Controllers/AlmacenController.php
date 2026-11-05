<?php

namespace App\Http\Controllers;

use App\Models\Estante;
use App\Models\Producto;

class AlmacenController extends Controller
{
    // Muestra la página del simulador 2D del almacén.
    // Le pasa las categorías (formulario de producto) y los límites de los estantes (modo edición).
    public function mostrar()
    {
        return view('almacen', [
            'categorias' => Producto::CATEGORIAS,
            'limites' => [
                'capacidad' => Estante::CAPACIDAD_MAXIMA,
                'por_fila' => Estante::POR_FILA_MAXIMO,
            ],
            'medidas' => [
                'grilla' => Estante::GRILLA,
                'ancho_minimo' => Estante::ANCHO_MINIMO,
                'alto_minimo' => Estante::ALTO_MINIMO,
                'ancho_mapa' => Estante::ANCHO_MAPA_SEGURO,
                'limite_inferior' => Estante::LIMITE_INFERIOR_MAPA,
            ],
        ]);
    }

    // Entrega TODO lo que necesita el mapa en un solo JSON:
    // los estantes (cada uno con sus prendas) y las prendas sin ubicar.
    public function listarEstantes()
    {
        $estantes = Estante::with('productos')->get()->map(fn($estante) => [
            'id' => $estante->id,
            'nombre' => $estante->nombre,
            'posicion_x' => $estante->posicion_x,
            'posicion_y' => $estante->posicion_y,
            'ancho' => $estante->ancho,
            'alto' => $estante->alto,
            'capacidad' => $estante->capacidad,
            'por_fila' => $estante->por_fila,   // NUEVO: casilleros por fila
            'ocupados' => $estante->productos->count(),
            'productos' => $estante->productos->map(fn($producto) => $this->formatearProducto($producto)),
        ]);

        $sinUbicar = Producto::whereNull('estante_id')->get()
            ->map(fn($producto) => $this->formatearProducto($producto));

        return response()->json([
            'estantes' => $estantes,
            'sin_ubicar' => $sinUbicar,
        ]);
    }

    // Entrega las prendas de UN estante en JSON.
    public function listarProductos(Estante $estante)
    {
        $productos = $estante->productos->map(fn($producto) => $this->formatearProducto($producto));

        return response()->json($productos);
    }

    // Entrega las prendas que todavía no tienen estante.
    public function listarSinUbicar()
    {
        $productos = Producto::whereNull('estante_id')->get()
            ->map(fn($producto) => $this->formatearProducto($producto));

        return response()->json($productos);
    }

    // Arma los datos de una prenda tal como los necesita el JavaScript.
    private function formatearProducto(Producto $producto): array
    {
        return [
            'id' => $producto->id,
            'codigo' => $producto->codigo,
            'nombre' => $producto->nombre,
            'categoria' => $producto->categoria,   // NUEVO: para poder filtrar por categoría
            'talle' => $producto->talle,
            'color' => $producto->color,
            'precio' => $producto->precio,
            'cantidad' => $producto->cantidad,
            'imagen_url' => $producto->imagen
                ? asset('imagenes/productos/' . $producto->imagen)
                : null,
            'casillero' => $producto->casillero,   // CAMBIA: antes eran interior_x e interior_y
        ];
    }
}