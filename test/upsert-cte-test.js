"use strict"; // eslint-disable-line semi

const pgConfig = { dbUrl: "postgres://localhost/pgrm-tests" }
const pgrm = require('../index.js')(pgConfig)
const chai = require('chai')

const assert = chai.assert

describe('upsert-cte-test.js', function () {

  describe('Create postgres CTE upsert', function () {
    it('Single parameter queries gets valid CTE', function () {
      const insert = {
        text: 'insert into consultant (java_exp) select $1',
        values: ['12']
      }
      const update = {
        text: 'update consultant set java_exp = $1 where id = (select id from consultant where weight = 100)',
        values: ['12']
      }
      const cte = pgrm.createUpsertCTE('foo', '*', { insert, update })
      return assert.deepEqual(cte,
        {
          text: 'with foo_update AS (update consultant set java_exp = $1 where id = (select id from consultant where weight = 100) returning *), foo_insert as (insert into consultant (java_exp) select $2 where not exists (select * from foo_update) returning *)(select * from foo_update) union all (select * from foo_insert)',
          values: ['12', '12']
        })
    })

    it('Multiparameter queries gets valid CTE', function () {
      const insert = {
        text: 'insert into consultant (java_exp, name) select $1, $2',
        values: [12, 'Bob']
      }
      const update = {
        text: 'update consultant set java_exp = $1 where name = $2',
        values: [12, 'Bob']
      }
      const cte = pgrm.createUpsertCTE('consut', 'consu_id', { insert, update })
      return assert.deepEqual(cte,
        {
          text: 'with consut_update AS (update consultant set java_exp = $1 where name = $2 returning consu_id), consut_insert as (insert into consultant (java_exp, name) select $3, $4 where not exists (select * from consut_update) returning consu_id)(select * from consut_update) union all (select * from consut_insert)',
          values: [12, 'Bob', 12, 'Bob']
        })
    })

    it('Multiparameter queries with subselects gets valid CTE', function () {
      const number = 1
      const number2 = 2
      const name = 'Bob'
      const date = new Date(2014, 11, 17)
      const date2 = new Date(2014, 11, 18)

      const insert = {
        text: 'insert into school_details_name(school_details_name_id, school_details_name_name, school_details_name_start_date, school_details_name_end_date, school_uuid) select $1, $2, $3, $4, (select school_uuid from school where school_number = $5)',
        values: [number, name, date, date2, number2]
      }
      const update = {
        text: 'update school_details_name set school_details_name_name = $1, school_details_name_start_date = $2, school_details_name_end_date = $3 where school_details_name_id = $4',
        values: [name, date, date2, number2]
      }
      const cte = pgrm.createUpsertCTE('school_details_name', 'school_details_name_uuid', { insert, update })
      return assert.deepEqual(cte,
        {
          text: 'with school_details_name_update AS (update school_details_name set school_details_name_name = $1, school_details_name_start_date = $2, school_details_name_end_date = $3 where school_details_name_id = $4 returning school_details_name_uuid), school_details_name_insert as (insert into school_details_name(school_details_name_id, school_details_name_name, school_details_name_start_date, school_details_name_end_date, school_uuid) select $5, $6, $7, $8, (select school_uuid from school where school_number = $9) where not exists (select * from school_details_name_update) returning school_details_name_uuid)(select * from school_details_name_update) union all (select * from school_details_name_insert)',
          values: [name, date, date2, number2, number, name, date, date2, number2]
        })
    })
  })

  describe('Create postgres multiple insert', function () {
    it('Single parameter queries gets valid CTE', function () {
      const insert = {
        text: 'insert into grading_score(grading_score_score, grading_question_id, student_uuid) values ($1, $2, $3)',
        values: [1, 2, 3]
      }
      const cte = pgrm.createMultipleInsertCTE(insert)
      return assert.deepEqual(cte, insert)
    })

    it('Multiparameter insert gets valid CTE', function () {
      const insert = {
        text: 'insert into grading_score(grading_score_score, grading_question_id, student_uuid) values($1, $2, $3)',
        values: [1, 2, 3, 4, 5, 6]
      }
      const cte = pgrm.createMultipleInsertCTE(insert)
      return assert.deepEqual(cte,
        {
          text: 'insert into grading_score(grading_score_score, grading_question_id, student_uuid) values($1, $2, $3),($4, $5, $6)',
          values: [1, 2, 3, 4, 5, 6]
        })
    })

    it('Multiparameter insert gets valid CTE with subselects', function () {
      const insert = {
        text: 'insert into grading_score(grading_score_score, grading_question_id, student_uuid)' +
          'values($1, ' +
          '(select grading_question_id from grading_question_details where grading_question_details_id = $2),' +
          '(select student_uuid from student_ssn where student_ssn = $3))',
        values: [1, 2, 3, 4, 5, 6]
      }
      const cte = pgrm.createMultipleInsertCTE(insert)
      return assert.deepEqual(cte,
        {
          text: 'insert into grading_score(grading_score_score, grading_question_id, student_uuid)' +
            'values($1, ' +
            '(select grading_question_id from grading_question_details where grading_question_details_id = $2),' +
            '(select student_uuid from student_ssn where student_ssn = $3)),' +
            '($4, ' +
            '(select grading_question_id from grading_question_details where grading_question_details_id = $5),' +
            '(select student_uuid from student_ssn where student_ssn = $6))',
          values: [1, 2, 3, 4, 5, 6]
        })
    })

    it('Multiparameter insert gets valid CTE with subselects and only one set of params', function () {
      const insert = {
        text: 'insert into grading_score(grading_score_score, grading_question_id, student_uuid)' +
          'values' +
          ' ($1, (select grading_question_id from grading_details where grading_details_question_id = $2), (select student_uuid from student_ssn where student_ssn = $3))',
        values: [1, 2, 3]
      }
      const cte = pgrm.createMultipleInsertCTE(insert)
      return assert.deepEqual(cte,
        {
          text: 'insert into grading_score(grading_score_score, grading_question_id, student_uuid)' +
            'values' +
            ' ($1, (select grading_question_id from grading_details where grading_details_question_id = $2), (select student_uuid from student_ssn where student_ssn = $3))',
          values: [1, 2, 3]
        })
    })

    it('Multiparameter insert gets valid CTE with subselects and functions with params', function () {
      const insert = {
        text: 'insert into grading_score(grading_score_score, grading_question_id, student_uuid) ' +
          'values' +
          ' ($1, (select grading_question_id from grading_details where grading_details_question_id = $2), (select student_uuid_for_ssn($3,$4)))',
        values: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      }
      const cte = pgrm.createMultipleInsertCTE(insert)
      return assert.deepEqual(cte, {
        text: 'insert into grading_score(grading_score_score, grading_question_id, student_uuid) values' +
          ' ($1, (select grading_question_id from grading_details where grading_details_question_id = $2), (select student_uuid_for_ssn($3,$4)))' +
          ',' +
          ' ($5, (select grading_question_id from grading_details where grading_details_question_id = $6), (select student_uuid_for_ssn($7,$8)))',
        values: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      })
    })

    it('Multiparameter insert gets valid CTE with recursive subselects and functions with params', function () {
      const insert = {
        text: 'insert into tableA (one, two, three, four) values ((select first from tableB where first_id = $1), (select second from tableC where second_id = (select functioncall($2, $3)) and some_other_id = (select third_id from tableD where param = $4)))',
        values: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      }
      const cte = pgrm.createMultipleInsertCTE(insert)
      return assert.deepEqual(cte, {
        text: 'insert into tableA (one, two, three, four) values ((select first from tableB where first_id = $1), (select second from tableC where second_id = (select functioncall($2, $3)) and some_other_id = (select third_id from tableD where param = $4))), ((select first from tableB where first_id = $5), (select second from tableC where second_id = (select functioncall($6, $7)) and some_other_id = (select third_id from tableD where param = $8)))',
        values: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      })
    })

    describe('Validates parameters', function () {
      it('and does not allow incorrect order', function () {
        const insert = { text: 'insert into foo(a,b,c) values ($2,$1,$3)', values: ['a', 'b', 'c'] }
        assert.throws(() => {
          pgrm.createMultipleInsertCTE(insert)
        })
      })
      it('and does not allow non matching count of values and parameters', function () {
        const insert = { text: 'insert into foo(a,b,c) values ($1,$2,$3)', values: ['a', 'b', 'c', 'd'] }
        assert.throws(() => {
          pgrm.createMultipleInsertCTE(insert)
        })
      })
    })

    it('Multiparameter insert gets valid CTE with values list with over 10 items', function () {
      const insert = {
        text: 'insert into table(a, b, c, d) values($1, $2, $3, $4)',
        values: range(1, 33)
      }
      const cte = pgrm.createMultipleInsertCTE(insert)
      return assert.deepEqual(cte,
        {
          text: 'insert into table(a, b, c, d) values($1, $2, $3, $4),($5, $6, $7, $8),($9, $10, $11, $12),($13, $14, $15, $16),($17, $18, $19, $20),($21, $22, $23, $24),($25, $26, $27, $28),($29, $30, $31, $32)',
          values: range(1, 33)
        })
    })

    it('Multiparameter insert gets valid CTE with inserts over 10 params', function () {
      const insert = {
        text: 'insert into table(a, b, c, d) values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        values: range(1, 23)
      }
      const cte = pgrm.createMultipleInsertCTE(insert)
      return assert.deepEqual(cte,
        {
          text: 'insert into table(a, b, c, d) values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11),($12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)',
          values: range(1, 23)
        })
    })
  })

  function range(start, end) {
    return Array.from(Array(end - start), (v, i) => i + start)
  }
})
