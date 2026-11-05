<?php

namespace App\Http\Controllers;

use App\Http\Requests\EstanteRequest;
use App\Models\Estante;
use Illuminate\Support\Facades\DB;

class EstanteController extends Controller
{
    // Crea un estante nuevo en el primer lugar libre del mapa.
    public function guardar(EstanteRequest $solicitud)
    {
        $posicion = Estante::buscarPosicionLibre();

        if ($posicion === null) {
            return response()->json(['mensaje' => 'No hay lugar libre en el mapa para un estante nuevo.'], 422);
        }

        $estante = Estante::create([
            ...$solicitud->validated(),
            'posicion_x' => $posicion['x'],
            'posicion_y' => $posicion['y'],
            'ancho'      => Estante::ANCHO_POR_DEFECTO,
            'alto'       => Estante::ALTO_POR_DEFECTO,
        ]);

        return response()->json(['mensaje' => 'Se creó ' . $estante->nombre . '.'], 201);
    }

    // Edita nombre, capacidad y prendas por fila de un estante.
    public function actualizar(EstanteRequest $solicitud, Estante $estante)
    {
        $estante->update($solicitud->validated());

        return response()->json(['mensaje' => 'Cambios guardados en ' . $estante->nombre . '.']);
    }

    // Elimina un estante. Sus prendas NO se borran: quedan "sin ubicar".
    public function eliminar(Estante $estante)
    {
        $cantidad = $estante->productos()->count();
        $nombre = $estante->nombre;

        // Todo o nada: si algo falla, no queda un estante a medias
        DB::transaction(function () use ($estante) {
            $estante->productos()->update(['estante_id' => null, 'casillero' => null]);
            $estante->delete();
        });

        $detalle = $cantidad > 0 ? " Sus $cantidad prendas quedaron sin ubicar." : '';

        return response()->json(['mensaje' => "Se eliminó $nombre.$detalle"]);
    }
}