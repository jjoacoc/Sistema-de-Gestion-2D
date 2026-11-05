<?php

namespace App\Http\Controllers;

use App\Models\Producto;
use Illuminate\Support\Facades\DB;

class PanelController extends Controller
{
    // Muestra el panel general con el resumen del stock.
    public function mostrar()
    {
        // Tarjetas: cuántas prendas distintas hay, cuántas unidades y cuánto dinero representan.
        // El valor es precio x cantidad de cada prenda, sumado (lo calcula la base de datos).
        $totalPrendas = Producto::count();
        $stockTotal = (int) Producto::sum('cantidad');
        $valorTotal = (float) Producto::sum(DB::raw('precio * cantidad'));

        // Gráfico: unidades y valor por categoría. Un solo GROUP BY en SQL.
        $porCategoria = Producto::select(
            'categoria',
            DB::raw('SUM(cantidad) as unidades'),
            DB::raw('SUM(precio * cantidad) as valor'),
        )
            ->groupBy('categoria')
            ->orderBy('categoria')
            ->get()
            ->map(fn ($fila) => [
                'categoria' => $fila->categoria,
                'unidades'  => (int) $fila->unidades,
                'valor'     => (float) $fila->valor,
            ]);

        // Lista de stock bajo: primero las que tienen menos unidades.
        // with('estante') trae todos los estantes en UNA consulta extra (evita una consulta por fila).
        $stockBajo = Producto::with('estante')
            ->where('cantidad', '<=', Producto::STOCK_BAJO)
            ->orderBy('cantidad')
            ->orderBy('nombre')
            ->get();

        return view('panel', [
            'totalPrendas' => $totalPrendas,
            'stockTotal'   => $stockTotal,
            'valorTotal'   => $valorTotal,
            'porCategoria' => $porCategoria,
            'stockBajo'    => $stockBajo,
            'limiteBajo'   => Producto::STOCK_BAJO,
        ]);
    }
}